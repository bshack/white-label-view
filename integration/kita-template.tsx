/** @jsxImportSource @kitajs/html */

export function renderKita(data: {name: string}): string {
    const output = <section><h1 safe>Hello {data.name}</h1></section>;
    if (typeof output !== 'string') {
        throw new TypeError('KitaJS compatibility requires synchronous string output');
    }
    return output;
}
