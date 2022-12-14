import { LightningElement, api } from 'lwc';
import tplA from './a.html';
import tplB from './b.html';

export default class Main extends LightningElement {
    static renderMode = 'light';

    @api useTplA;

    render() {
        return this.useTplA ? tplA : tplB;
    }
}
