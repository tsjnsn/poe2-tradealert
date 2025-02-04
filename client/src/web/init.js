import { init, events } from '@neutralinojs/lib';

const urlParams = new URLSearchParams(window.location.search);
const connectToken = urlParams.get('connectToken');
console.log({connectToken});
if (connectToken) {
    NL_TOKEN = connectToken;
}

init();