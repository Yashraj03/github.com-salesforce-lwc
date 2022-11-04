/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import * as t from '@babel/types';
import { DecoratorErrors } from '@lwc/errors';
import { LWC_COMPONENT_PROPERTIES, LWC_PACKAGE_EXPORTS } from '../../constants';
import { generateError } from '../../utils';

const TRACK_PROPERTY_VALUE = 1;
const { TRACK_DECORATOR } = LWC_PACKAGE_EXPORTS;
function isTrackDecorator(decorator: any) {
    return decorator.name === TRACK_DECORATOR;
}

function validate(decorators: any) {
    decorators.filter(isTrackDecorator).forEach(({ path }: any) => {
        if (!path.parentPath.isClassProperty()) {
            throw generateError(path, {
                errorInfo: DecoratorErrors.TRACK_ONLY_ALLOWED_ON_CLASS_PROPERTIES,
            });
        }
    });
}

function transform(decoratorMetas: any) {
    const objectProperties = [];
    const trackDecoratorMetas = decoratorMetas.filter(isTrackDecorator);
    if (trackDecoratorMetas.length) {
        const config = trackDecoratorMetas.reduce((acc: any, meta: any) => {
            acc[meta.propertyName] = TRACK_PROPERTY_VALUE;
            return acc;
        }, {} as any);
        objectProperties.push(
            t.objectProperty(t.identifier(LWC_COMPONENT_PROPERTIES.TRACK), t.valueToNode(config))
        );
    }
    return objectProperties;
}
const name = TRACK_DECORATOR;
export { name, transform, validate };
