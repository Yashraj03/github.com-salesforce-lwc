import { LightningElement } from 'lwc';

export default class Main extends LightningElement {
    connectedCallback() {
        this.classList.remove('foo');
    }
}
