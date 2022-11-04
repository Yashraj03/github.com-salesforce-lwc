/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { LWC_PACKAGE_EXPORTS } from '../../constants';

function isWireDecorator(decorator: any) {
    return decorator.name === LWC_PACKAGE_EXPORTS.WIRE_DECORATOR;
}

export { isWireDecorator };
