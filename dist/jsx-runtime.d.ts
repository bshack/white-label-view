declare const fragment: unique symbol;
export interface RawMarkup {
    readonly __whiteLabelRawMarkup: true;
    readonly value: string;
}
export interface JSXMarkup {
    readonly __whiteLabelJSXMarkup: true;
    readonly value: string;
    toString(): string;
}
export type JSXChild = string | number | bigint | boolean | null | undefined | RawMarkup | JSXMarkup | JSXChild[];
export type JSXComponent = (props: Record<string, unknown>) => JSXChild;
export type JSXType = string | JSXComponent | typeof fragment;
/** Mark caller-owned markup as trusted so it is inserted without escaping. */
export declare function raw(value: string): RawMarkup;
/** Identify output created by this JSX runtime. */
export declare function isJSXMarkup(value: unknown): value is JSXMarkup;
/** Automatic JSX runtime entry point. Output remains distinguishable from plain text until the final render boundary. */
export declare function jsx(type: JSXType, props: Record<string, unknown> | null): JSXMarkup;
export declare const jsxs: typeof jsx;
export declare const jsxDEV: typeof jsx;
export declare const Fragment: symbol;
export declare namespace JSX {
    type Element = JSXMarkup;
    interface IntrinsicElements {
        [name: string]: Record<string, unknown>;
    }
    interface ElementChildrenAttribute {
        children: Record<string, unknown>;
    }
}
export {};
