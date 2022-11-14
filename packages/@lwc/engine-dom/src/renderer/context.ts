import { defineProperties } from '@lwc/shared';
import { addEventListener, dispatchEvent } from './index';
import type {
    WireContextValue,
    WireContextSubscriptionPayload,
    WireContextSubscriptionCallback,
} from '@lwc/engine-core';

export class WireContextSubscriptionEvent extends CustomEvent<undefined> {
    // These are initialized on the constructor via defineProperties.
    public readonly setNewContext!: (newContext: WireContextValue) => void;
    public readonly setDisconnectedCallback!: (disconnectCallback: () => void) => void;

    constructor(
        adapterToken: string,
        { setNewContext, setDisconnectedCallback }: WireContextSubscriptionPayload
    ) {
        super(adapterToken, {
            bubbles: true,
            composed: true,
        });

        defineProperties(this, {
            setNewContext: {
                value: setNewContext,
            },
            setDisconnectedCallback: {
                value: setDisconnectedCallback,
            },
        });
    }
}

export function registerContextConsumer(
    elm: Node,
    adapterContextToken: string,
    subscriptionPayload: WireContextSubscriptionPayload
) {
    dispatchEvent(elm, new WireContextSubscriptionEvent(adapterContextToken, subscriptionPayload));
}

export function registerContextProvider(
    elm: Node,
    adapterContextToken: string,
    onContextSubscription: WireContextSubscriptionCallback
) {
    addEventListener(elm, adapterContextToken, ((evt: WireContextSubscriptionEvent) => {
        const { setNewContext, setDisconnectedCallback } = evt;
        onContextSubscription({
            setNewContext,
            setDisconnectedCallback,
        });
        evt.stopImmediatePropagation();
    }) as EventListener);
}
