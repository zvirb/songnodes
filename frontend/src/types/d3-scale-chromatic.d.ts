declare module 'd3-scale-chromatic' {
  export const schemeCategory10: readonly string[];
  export function interpolateViridis(t: number): string;
  export function interpolatePlasma(t: number): string;
  export function interpolateInferno(t: number): string;
  export function interpolateMagma(t: number): string;
  export function interpolateTurbo(t: number): string;
  export function interpolateWarm(t: number): string;
  export function interpolateCool(t: number): string;
  export function interpolateRainbow(t: number): string;
  export function interpolateCubehelixDefault(t: number): string;
  export function interpolateSpectral(t: number): string;
  export const schemeSpectral: readonly (readonly string[])[];
  export const schemePaired: readonly string[];
  export const schemeSet1: readonly string[];
  export const schemeSet2: readonly string[];
  export const schemeSet3: readonly string[];
}