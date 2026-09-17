/** @jsxImportSource @kitajs/html */

export function renderKita(data: {name: string}): string {
    return <section><h1 safe>Hello {data.name}</h1></section>;
}
