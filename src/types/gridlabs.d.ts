declare module 'virtual:gridlabs-map' {
  export interface GridItem {
    id: number;
    file: string;
    route: string;
    name: string;
  }
  const items: GridItem[];
  export default items;
}