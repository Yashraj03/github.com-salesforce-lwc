/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import * as t from '@babel/types';

import { DECORATOR_TYPES, LWC_COMPONENT_PROPERTIES } from '../../constants';

import { isApiDecorator } from './shared';

const { PUBLIC_METHODS, PUBLIC_PROPS } = LWC_COMPONENT_PROPERTIES;
const PUBLIC_PROP_BIT_MASK = {
    PROPERTY: 0,
    GETTER: 1,
    SETTER: 2,
};

function getPropertyBitmask(type: any) {
    switch (type) {
        case DECORATOR_TYPES.GETTER:
            return PUBLIC_PROP_BIT_MASK.GETTER;

        case DECORATOR_TYPES.SETTER:
            return PUBLIC_PROP_BIT_MASK.SETTER;

        default:
            return PUBLIC_PROP_BIT_MASK.PROPERTY;
    }
}

function getSiblingGetSetPairType(propertyName: string, type: string, classBodyItems: any) {
    const siblingKind = type === DECORATOR_TYPES.GETTER ? 'set' : 'get';
    const siblingNode = classBodyItems.find((classBodyItem: any) => {
        const isClassMethod = classBodyItem.isClassMethod({ kind: siblingKind });
        const isSamePropertyName = classBodyItem.node.key.name === propertyName;
        return isClassMethod && isSamePropertyName;
    });
    if (siblingNode) {
        return siblingKind === 'get' ? DECORATOR_TYPES.GETTER : DECORATOR_TYPES.SETTER;
    }
}

function computePublicPropsConfig(publicPropertyMetas: any, classBodyItems: any) {
    return publicPropertyMetas.reduce((acc: any, { propertyName, decoratedNodeType }: any) => {
        if (!(propertyName in acc)) {
            acc[propertyName] = {};
        }
        acc[propertyName].config |= getPropertyBitmask(decoratedNodeType);

        if (
            decoratedNodeType === DECORATOR_TYPES.GETTER ||
            decoratedNodeType === DECORATOR_TYPES.SETTER
        ) {
            // With the latest decorator spec, only one of the getter/setter pair needs a decorator.
            // We need to add the proper bitmask for the sibling getter/setter if it exists.
            const pairType = getSiblingGetSetPairType(
                propertyName,
                decoratedNodeType,
                classBodyItems
            );
            if (pairType) {
                acc[propertyName].config |= getPropertyBitmask(pairType);
            }
        }

        return acc;
    }, {});
}

export default function transform(decoratorMetas: any, classBodyItems: any) {
    const objectProperties = [];
    const apiDecoratorMetas = decoratorMetas.filter(isApiDecorator);
    const publicPropertyMetas = apiDecoratorMetas.filter(
        ({ decoratedNodeType }: any) => decoratedNodeType !== DECORATOR_TYPES.METHOD
    );
    if (publicPropertyMetas.length) {
        const propsConfig = computePublicPropsConfig(publicPropertyMetas, classBodyItems);
        objectProperties.push(
            t.objectProperty(t.identifier(PUBLIC_PROPS), t.valueToNode(propsConfig))
        );
    }

    const publicMethodMetas = apiDecoratorMetas.filter(
        ({ decoratedNodeType }: any) => decoratedNodeType === DECORATOR_TYPES.METHOD
    );
    if (publicMethodMetas.length) {
        const methodNames = publicMethodMetas.map(({ propertyName }: any) => propertyName);
        objectProperties.push(
            t.objectProperty(t.identifier(PUBLIC_METHODS), t.valueToNode(methodNames))
        );
    }
    return objectProperties;
}
