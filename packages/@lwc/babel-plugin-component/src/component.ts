/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { basename, extname } from 'path';

import moduleImports from '@babel/helper-module-imports';

import { LWC_PACKAGE_ALIAS, REGISTER_COMPONENT_ID, TEMPLATE_KEY } from './constants';

function getBaseName(classPath: any) {
    const ext = extname(classPath);
    return basename(classPath, ext);
}

function importDefaultTemplate(path: any, state: any) {
    const { filename } = state.file.opts;
    const componentName = getBaseName(filename);
    return moduleImports.addDefault(path, `./${componentName}.html`, {
        nameHint: TEMPLATE_KEY,
    });
}

function needsComponentRegistration(path: any) {
    return (
        (path.isIdentifier() && path.node.name !== 'undefined' && path.node.name !== 'null') ||
        path.isCallExpression() ||
        path.isClassDeclaration() ||
        path.isConditionalExpression()
    );
}

export default function ({ types: t }: any) {
    function createRegisterComponent(declarationPath: any, state: any) {
        const registerComponentId = moduleImports.addNamed(
            declarationPath,
            REGISTER_COMPONENT_ID,
            LWC_PACKAGE_ALIAS
        );
        const templateIdentifier = importDefaultTemplate(declarationPath, state);
        const statementPath = declarationPath.getStatementParent();
        let node = declarationPath.node;

        if (declarationPath.isClassDeclaration()) {
            const hasIdentifier = t.isIdentifier(node.id);
            if (hasIdentifier) {
                statementPath.insertBefore(node);
                node = node.id;
            } else {
                // if it does not have an id, we can treat it as a ClassExpression
                t.toExpression(node);
            }
        }

        return t.callExpression(registerComponentId, [
            node,
            t.objectExpression([t.objectProperty(t.identifier(TEMPLATE_KEY), templateIdentifier)]),
        ]);
    }

    return {
        ExportDefaultDeclaration(path: any, state: any) {
            const implicitResolution = !state.opts.isExplicitImport;
            if (implicitResolution) {
                const declaration = path.get('declaration');
                if (needsComponentRegistration(declaration)) {
                    declaration.replaceWith(createRegisterComponent(declaration, state));
                }
            }
        },
    };
}
