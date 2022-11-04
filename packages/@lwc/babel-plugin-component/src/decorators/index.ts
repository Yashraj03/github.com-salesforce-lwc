/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import moduleImports from '@babel/helper-module-imports';
import * as t from '@babel/types';
import { DecoratorErrors } from '@lwc/errors';

import { NodePath } from '@babel/core';
import { isArray } from '@lwc/shared';
import { DECORATOR_TYPES, LWC_PACKAGE_ALIAS, REGISTER_DECORATORS_ID } from '../constants';
import { generateError, isClassMethod, isSetterClassMethod, isGetterClassMethod } from '../utils';

import * as api from './api';
import * as wire from './wire';
import * as track from './track';

const DECORATOR_TRANSFORMS = [api, wire, track];
const AVAILABLE_DECORATORS = DECORATOR_TRANSFORMS.map((transform) => transform.name).join(', ');

function isLwcDecoratorName(name: string) {
    return DECORATOR_TRANSFORMS.some((transform) => transform.name === name);
}

/** Returns a list of all the references to an identifier */
function getReferences(identifier: t.Identifier) {
    return identifier.scope.getBinding(identifier.node.name).referencePaths;
}

/** Returns the type of decorator depdending on the property or method if get applied to */
function getDecoratedNodeType(decoratorPath: NodePath<t.Decorator>): string {
    const propertyOrMethod = decoratorPath.parentPath;
    if (isClassMethod(propertyOrMethod)) {
        return DECORATOR_TYPES.METHOD;
    } else if (isGetterClassMethod(propertyOrMethod)) {
        return DECORATOR_TYPES.GETTER;
    } else if (isSetterClassMethod(propertyOrMethod)) {
        return DECORATOR_TYPES.SETTER;
    } else if (propertyOrMethod.isClassProperty()) {
        return DECORATOR_TYPES.PROPERTY;
    } else {
        throw generateError(propertyOrMethod, {
            errorInfo: DecoratorErrors.INVALID_DECORATOR_TYPE,
        });
    }
}

function validateImportedLwcDecoratorUsage(engineImportSpecifiers) {
    engineImportSpecifiers
        .filter(({ name }) => isLwcDecoratorName(name))
        .reduce((acc, { name, path }) => {
            // Get a list of all the  local references
            const local = path.get('imported');
            const references = getReferences(local).map((reference) => ({
                name,
                reference,
            }));

            return [...acc, ...references];
        }, [])
        .forEach(({ name, reference }) => {
            // Get the decorator from the identifier
            // If the the decorator is:
            //   - an identifier @track : the decorator is the parent of the identifier
            //   - a call expression @wire("foo") : the decorator is the grand-parent of the identifier
            const decorator = reference.parentPath.isDecorator()
                ? reference.parentPath
                : reference.parentPath.parentPath;

            if (!decorator.isDecorator()) {
                throw generateError(decorator, {
                    errorInfo: DecoratorErrors.IS_NOT_DECORATOR,
                    messageArgs: [name],
                });
            }

            const propertyOrMethod = decorator.parentPath;
            if (!propertyOrMethod.isClassProperty() && !propertyOrMethod.isClassMethod()) {
                throw generateError(propertyOrMethod, {
                    errorInfo: DecoratorErrors.IS_NOT_CLASS_PROPERTY_OR_CLASS_METHOD,
                    messageArgs: [name],
                });
            }
        });
}

function isImportedFromLwcSource(decoratorBinding) {
    const bindingPath = decoratorBinding.path;
    return bindingPath.isImportSpecifier() && bindingPath.parent.source.value === 'lwc';
}

/** Validate the usage of decorator by calling each validation function */
function validate(decorators) {
    for (const { name, path } of decorators) {
        const binding = path.scope.getBinding(name);
        if (binding === undefined || !isImportedFromLwcSource(binding)) {
            throw generateInvalidDecoratorError(path);
        }
    }
    DECORATOR_TRANSFORMS.forEach(({ validate }) => validate(decorators));
}

/** Remove import specifiers. It also removes the import statement if the specifier list becomes empty */
function removeImportedDecoratorSpecifiers(engineImportSpecifiers) {
    engineImportSpecifiers
        .filter(({ name }) => isLwcDecoratorName(name))
        .forEach(({ path }) => {
            const importStatement = path.parentPath;
            path.remove();
            if (importStatement.get('specifiers').length === 0) {
                importStatement.remove();
            }
        });
}

function generateInvalidDecoratorError(path) {
    const expressionPath = path.get('expression');
    const { node } = path;
    const { expression } = node;

    let name;
    if (expressionPath.isIdentifier()) {
        name = expression.name;
    } else if (expressionPath.isCallExpression()) {
        name = expression.callee.name;
    }

    if (name) {
        return generateError(path.parentPath, {
            errorInfo: DecoratorErrors.INVALID_DECORATOR_WITH_NAME,
            messageArgs: [name, AVAILABLE_DECORATORS, LWC_PACKAGE_ALIAS],
        });
    } else {
        return generateError(path.parentPath, {
            errorInfo: DecoratorErrors.INVALID_DECORATOR,
            messageArgs: [AVAILABLE_DECORATORS, LWC_PACKAGE_ALIAS],
        });
    }
}

function collectDecoratorPaths(bodyItems: NodePath[]): NodePath<t.Decorator>[] {
    return bodyItems.reduce((acc, bodyItem) => {
        const decorators = bodyItem.get('decorators');
        if (isArray(decorators) && decorators.length) {
            acc.push(...(decorators as NodePath<t.Decorator>[]));
        }
        return acc;
    }, [] as NodePath<t.Decorator>[]);
}

interface DecoratorMetadata {
    name: string;
    propertyName: string;
    path: NodePath<t.Decorator>;
    decoratedNodeType: string;
}

function getDecoratorMetadata(decoratorPath: NodePath<t.Decorator>): DecoratorMetadata {
    const expressionPath = decoratorPath.get('expression') as NodePath<t.Expression>;

    let name;
    if (expressionPath.isIdentifier()) {
        name = expressionPath.node.name;
    } else if (expressionPath.isCallExpression() && t.isIdentifier(expressionPath.node.callee)) {
        name = expressionPath.node.callee.name;
    } else {
        throw generateInvalidDecoratorError(decoratorPath);
    }

    const propertyName = (decoratorPath.parent as any).key.name;
    const decoratedNodeType = getDecoratedNodeType(decoratorPath);

    return {
        name,
        propertyName,
        path: decoratorPath,
        decoratedNodeType,
    };
}

function getMetadataObjectPropertyList(
    decoratorMetas: DecoratorMetadata[],
    classBodyItems: NodePath[]
) {
    const list = [
        ...api.transform(decoratorMetas, classBodyItems),
        ...track.transform(decoratorMetas),
        ...wire.transform(decoratorMetas),
    ];

    const fieldNames = classBodyItems
        .filter((field) => field.isClassProperty({ computed: false, static: false }))
        .filter((field) => !(field.node as t.ClassProperty).decorators)
        .map((field) => ((field.node as t.ClassProperty).key as t.Identifier).name);
    if (fieldNames.length) {
        list.push(t.objectProperty(t.identifier('fields'), t.valueToNode(fieldNames)));
    }

    return list;
}

function decorators() {
    function createRegisterDecoratorsCallExpression(
        path: NodePath<t.Class>,
        classExpression: t.Expression | t.Identifier,
        props: Array<t.ObjectProperty>
    ): t.CallExpression {
        const id = moduleImports.addNamed(path, REGISTER_DECORATORS_ID, LWC_PACKAGE_ALIAS);
        return t.callExpression(id, [classExpression, t.objectExpression(props)]);
    }

    // Babel reinvokes visitors for node reinsertion so we use this to avoid an infinite loop.
    const visitedClasses = new WeakSet();

    return {
        Class(path: NodePath<t.Class>) {
            const { node } = path;

            if (visitedClasses.has(node)) {
                return;
            }
            visitedClasses.add(node);

            const classBodyItems = path.get('body.body');
            if (isArray(classBodyItems) && classBodyItems.length === 0) {
                return;
            }

            const decoratorPaths = collectDecoratorPaths(classBodyItems as NodePath[]);
            const decoratorMetas = decoratorPaths.map(getDecoratorMetadata);

            validate(decoratorMetas);

            const metaPropertyList = getMetadataObjectPropertyList(
                decoratorMetas,
                classBodyItems as NodePath[]
            );
            if (metaPropertyList.length === 0) {
                return;
            }

            decoratorPaths.forEach((path: any) => path.remove());

            const isAnonymousClassDeclaration =
                path.isClassDeclaration() && !path.get('id').isIdentifier();
            const shouldTransformAsClassExpression =
                path.isClassExpression() || isAnonymousClassDeclaration;

            if (shouldTransformAsClassExpression) {
                // Example:
                //      export default class extends LightningElement {}
                // Output:
                //      export default registerDecorators(class extends LightningElement {});
                // if it does not have an id, we can treat it as a ClassExpression
                const classExpression = t.toExpression(node);
                path.replaceWith(
                    createRegisterDecoratorsCallExpression(
                        path,
                        classExpression,
                        metaPropertyList
                    ) as any
                );
            } else {
                // Example: export default class NamedClass extends LightningElement {}
                // Output:
                //      export default class NamedClass extends LightningElement {}
                //      registerDecorators(NamedClass);
                // Note: This will be further transformed
                const statementPath = path.getStatementParent();
                statementPath!.insertAfter(
                    t.expressionStatement(
                        createRegisterDecoratorsCallExpression(path, node.id!, metaPropertyList)
                    ) as any
                );
            }
        },
    };
}

export { decorators, removeImportedDecoratorSpecifiers, validateImportedLwcDecoratorUsage };
