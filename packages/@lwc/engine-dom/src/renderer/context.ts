import { defineProperties } from '@lwc/shared';
import { dispatchEvent } from './index';
import type {
    WireContextValue,
    WireContextRegistrationPayload,
} from '@lwc/engine-core';

export class WireContextRegistrationEvent extends CustomEvent<undefined> {
    // These are initialized on the constructor via defineProperties.
    public readonly setNewContext!: (newContext: WireContextValue) => void;
    public readonly setDisconnectedCallback!: (disconnectCallback: () => void) => void;

    constructor(
        adapterToken: string,
        { setNewContext, setDisconnectedCallback }: WireContextRegistrationPayload
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
    contextRegistrationPayload: WireContextRegistrationPayload,
) {
    dispatchEvent(
        elm,
        new WireContextRegistrationEvent(
            adapterContextToken,
            contextRegistrationPayload,
        )
    );
}
