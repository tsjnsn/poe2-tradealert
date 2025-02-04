declare module '@neutralinojs/lib' {
  interface NeutralinoEvent<T = any> {
    detail: T;
  }

  interface NeutralinoEvents {
    on(event: string, callback: (event: NeutralinoEvent) => void): void;
    broadcast(event: string, data?: any): void;
    exit(): Promise<void>;
  }

  interface NeutralinoStorage {
    setData(key: string, data: any): Promise<void>;
    getData(key: string): Promise<any>;
  }

  interface NeutralinoOS {
    open(url: string): Promise<void>;
  }

  interface Neutralino {
    init(): Promise<void>;
    events: NeutralinoEvents;
    storage: NeutralinoStorage;
    os: NeutralinoOS;
  }

  const Neutralino: Neutralino;
  export default Neutralino;
} 