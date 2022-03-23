import { TypedArray } from "bitecs";

export type ResourceLoaderFactory<D extends ResourceDefinition, T> = (manager: ResourceManager) => ResourceLoader<D, T>;

export interface ResourceLoader<D extends ResourceDefinition, T> {
  type: string;
  load(resourceDef: D): Promise<T>;
  dispose(resourceInfo: ResourceInfo<T>): void;
}

export interface ResourceManager {
  buffer: SharedArrayBuffer;
  view: Uint32Array;
  store: Map<number, ResourceInfo<any>>;
  urlToResourceId: Map<string, number>;
  resourceLoaders: Map<string, ResourceLoader<any, any>>;
}

export enum ResourceState {
  Loading = "loading",
  Loaded = "loaded",
  Error = "error",
}

export interface ResourceInfo<Resource> {
  resourceId: number;
  type: string;
  name: string;
  count: number;
  state: ResourceState;
  url?: string;
  resource?: Resource;
  promise: Promise<Resource>;
  error?: Error;
}

export interface RemoteResourceInfo {
  resourceId: number;
  type: string;
  url?: string;
  count: number;
  state: ResourceState;
}

export enum ResourceManagerCommand {
  Load = "load",
  AddRef = "add-ref",
  RemoveRef = "remove-ref",
}

export interface RemoteResourceMessage {
  command: ResourceManagerCommand;
}

export interface ResourceDefinition {
  type: string;
  name?: string;
  url?: string;
  [key: string]: any;
}

export interface LoadResourceMessage extends RemoteResourceMessage {
  command: ResourceManagerCommand.Load;
  resourceId: number;
  resourceDef: ResourceDefinition;
}

export interface AddResourceRefMessage extends RemoteResourceMessage {
  command: ResourceManagerCommand.AddRef;
  resourceId: number;
}

export interface RemoveResourceRefMessage extends RemoteResourceMessage {
  command: ResourceManagerCommand.RemoveRef;
  resourceId: number;
}

export interface RemoteResourceManager {
  buffer: SharedArrayBuffer;
  view: Uint32Array;
  messageQueue: RemoteResourceMessage[];
  transferList: Transferable[];
  store: Map<number, RemoteResourceInfo>;
  urlToResourceId: Map<string, number>;
}

const RESOURCE_ID_INDEX = 0;

export function createResourceManager(): ResourceManager {
  const buffer = new SharedArrayBuffer(4);

  return {
    buffer,
    view: new Uint32Array(buffer),
    store: new Map(),
    urlToResourceId: new Map(),
    resourceLoaders: new Map(),
  };
}

export function registerResourceLoader(
  manager: ResourceManager,
  loaderFactory: ResourceLoaderFactory<any, any>
): void {
  const loader = loaderFactory(manager);
  manager.resourceLoaders.set(loader.type, loader);
}

export function processRemoteResourceMessages(
  manager: ResourceManager,
  messages: RemoteResourceMessage[]
) {
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    switch (message.command) {
      case ResourceManagerCommand.Load: {
        const { resourceId, resourceDef } = message as LoadResourceMessage;
        loadResource(manager, resourceId, resourceDef);
        break;
      }
      case ResourceManagerCommand.AddRef: {
        const { resourceId } = message as AddResourceRefMessage;
        addResourceRef(manager, resourceId);
        break;
      }
      case ResourceManagerCommand.RemoveRef: {
        const { resourceId } = message as RemoveResourceRefMessage;
        removeResourceRef(manager, resourceId);
        break;
      }
    }
  }
}

export function createResource<T>(
  manager: ResourceManager,
  resourceDef: ResourceDefinition
): Promise<ResourceInfo<T>> {
  const resourceId = Atomics.add(manager.view, RESOURCE_ID_INDEX, 1);
  return loadResource(manager, resourceId, resourceDef);
}

export async function loadResource<D extends ResourceDefinition, T>(
  manager: ResourceManager,
  resourceId: number,
  resourceDef: D
): Promise<ResourceInfo<T>> {
  const type = resourceDef.type;
  const loader: ResourceLoader<D, T> = manager.resourceLoaders.get(type);

  if (!loader) {
    throw new Error(`Resource loader ${type} not registered.`);
  }

  const resourceInfo: ResourceInfo<T> = {
    resourceId,
    type,
    name: resourceDef.name,
    url: resourceDef.url,
    count: 1,
    state: ResourceState.Loading,
    resource: undefined,
    promise: loader.load(resourceDef),
  };

  manager.store.set(resourceId, resourceInfo);

  if (resourceDef.url) {
    manager.urlToResourceId.set(resourceDef.url, resourceId);
  }

  try {
    resourceInfo.resource = await resourceInfo.promise;
    resourceInfo.state = ResourceState.Loaded;
  } catch (error) {
    resourceInfo.state = ResourceState.Error;
    resourceInfo.error = error;
  }

  return resourceInfo;
}

export function addResourceRef(manager: ResourceManager, resourceId: number) {
  const resourceInfo = manager.store.get(resourceId);

  if (!resourceInfo) {
    return;
  }

  resourceInfo.count++;
}

export function removeResourceRef(manager: ResourceManager, resourceId: number) {
  const resourceInfo = manager.store.get(resourceId);

  if (!resourceInfo) {
    return;
  }

  if (resourceInfo.count === 1) {
    if (resourceInfo.url) {
      manager.urlToResourceId.delete(resourceInfo.url);
    }

    manager.store.delete(resourceId);
    manager.resourceLoaders.get(resourceInfo.type).dispose(resourceInfo);
  } else {
    resourceInfo.count--;
  }
}

export function createRemoteResourceManager(buffer: SharedArrayBuffer): RemoteResourceManager {
  return {
    buffer,
    view: new Uint32Array(buffer),
    messageQueue: [],
    transferList: [],
    store: new Map(),
    urlToResourceId: new Map(),
  };
}

export function loadRemoteResource(
  manager: RemoteResourceManager,
  resourceDef: ResourceDefinition,
  transferList?: Transferable[]
): number {
  const resourceId = Atomics.add(manager.view, RESOURCE_ID_INDEX, 1);

  manager.store.set(resourceId, {
    resourceId,
    type: resourceDef.type,
    count: 1,
    state: ResourceState.Loading,
    url: resourceDef.url,
  });

  if (resourceDef.url) {
    manager.urlToResourceId.set(resourceDef.url, resourceId);
  }

  manager.messageQueue.push({
    command: ResourceManagerCommand.Load,
    resourceId,
    resourceDef,
  } as RemoteResourceMessage);

  if (transferList) {
    manager.transferList.push(...transferList);
  }

  return resourceId;
}

export function addRemoteResourceRef(
  manager: RemoteResourceManager,
  resourceId: number
) {
  const resourceInfo = manager.store.get(resourceId);
  resourceInfo.count++;
  manager.messageQueue.push({
    command: ResourceManagerCommand.AddRef,
    resourceId,
  } as RemoteResourceMessage);
}

export function removeRemoteResourceRef(
  manager: RemoteResourceManager,
  resourceId: number
) {
  manager.messageQueue.push({
    command: ResourceManagerCommand.RemoveRef,
    resourceId,
  } as RemoteResourceMessage);

  const resourceInfo = manager.store.get(resourceId);

  if (resourceInfo.count === 1) {
    if (resourceInfo.url) {
      manager.urlToResourceId.delete(resourceInfo.url);
    }

    manager.store.delete(resourceId);
  } else {
    resourceInfo.count--;
  }
}

export function getRemoteResource(
  manager: RemoteResourceManager,
  resourceId: number
): RemoteResourceInfo | undefined {
  return manager.store.get(resourceId);
}

export function getRemoteResourceByUrl(
  manager: RemoteResourceManager,
  url: string
): RemoteResourceInfo | undefined {
  const resourceId = manager.urlToResourceId.get(url);

  if (resourceId === undefined) {
    return undefined;
  }

  return manager.store.get(resourceId);
}

/**
 * Examples:
 */

export function loadRemoteGLTF(
  manager: RemoteResourceManager,
  url: string
): number {
  const remoteResource = getRemoteResourceByUrl(manager, url);

  if (remoteResource) {
    addRemoteResourceRef(manager, remoteResource.resourceId);
    return remoteResource.resourceId;
  }

  return loadRemoteResource(manager, {
    type: "gltf",
    url,
  });
}

export function loadRemoteGeometry(
  manager: RemoteResourceManager,
  indices: Uint32Array,
  attributes: { [name: string]: TypedArray }
): number {
  return loadRemoteResource(manager, {
    type: "geometry",
    indices,
    attributes,
  });
}
