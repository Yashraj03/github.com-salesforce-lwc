/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { isUndefined, ArrayPush } from '@lwc/shared';
import { guid } from './utils';
import { VM } from './vm';
import {
    WireAdapterConstructor,
    ContextValue,
    getAdapterToken,
    setAdapterToken,
    WireContextRegistrationEvent,
    WireDef,
} from './wiring';

interface ContextConsumer {
    provide(newContext: ContextValue): void;
}

interface ContextProviderOptions {
    consumerConnectedCallback: (consumer: ContextConsumer) => void;
    consumerDisconnectedCallback?: (consumer: ContextConsumer) => void;
}

// this is lwc internal implementation
export function createContextProvider(adapter: WireAdapterConstructor) {
    let adapterContextToken = getAdapterToken(adapter);
    if (!isUndefined(adapterContextToken)) {
        throw new Error(`Adapter already has a context provider.`);
    }
    adapterContextToken = guid();
    setAdapterToken(adapter, adapterContextToken);
    const providers = new WeakSet<EventTarget>();

    return (elm: EventTarget, options: ContextProviderOptions) => {
        if (providers.has(elm)) {
            throw new Error(`Adapter was already installed on ${elm}.`);
        }
        providers.add(elm);

        const { consumerConnectedCallback, consumerDisconnectedCallback } = options;
        elm.addEventListener(
            adapterContextToken as string,
            ((evt: WireContextRegistrationEvent) => {
                const { setNewContext, setDisconnectedCallback } = evt;

                const consumer: ContextConsumer = {
                    provide(newContext) {
                        setNewContext(newContext);
                    },
                };
                const disconnectCallback = () => {
                    if (!isUndefined(consumerDisconnectedCallback)) {
                        consumerDisconnectedCallback(consumer);
                    }
                };
                setDisconnectedCallback(disconnectCallback);

                consumerConnectedCallback(consumer);
                evt.stopImmediatePropagation();
            }) as EventListener
        );
    };
}

export function createContextWatcher(
    vm: VM,
    wireDef: WireDef,
    callbackWhenContextIsReady: (newContext: ContextValue) => void
) {
    const { adapter } = wireDef;
    const adapterContextToken = getAdapterToken(adapter);
    if (isUndefined(adapterContextToken)) {
        return; // no provider found, nothing to be done
    }
    const {
        elm,
        context: { wiredConnecting, wiredDisconnecting },
        renderer: { dispatchEvent },
    } = vm;
    // waiting for the component to be connected to formally request the context via the token
    ArrayPush.call(wiredConnecting, () => {
        // This event is responsible for connecting the host element with another
        // element in the composed path that is providing contextual data. The provider
        // must be listening for a special dom event with the name corresponding to the value of
        // `adapterContextToken`, which will remain secret and internal to this file only to
        // guarantee that the linkage can be forged.
        const contextRegistrationEvent = new WireContextRegistrationEvent(adapterContextToken, {
            setNewContext(newContext: ContextValue) {
                // eslint-disable-next-line @lwc/lwc-internal/no-invalid-todo
                // TODO: dev-mode validation of config based on the adapter.contextSchema
                callbackWhenContextIsReady(newContext);
            },
            setDisconnectedCallback(disconnectCallback: () => void) {
                // adds this callback into the disconnect bucket so it gets disconnected from parent
                // the the element hosting the wire is disconnected
                ArrayPush.call(wiredDisconnecting, disconnectCallback);
            },
        });
        dispatchEvent(elm, contextRegistrationEvent);
    });
}
