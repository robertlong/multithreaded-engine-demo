import { BoxBufferGeometry, Mesh, MeshBasicMaterial, Scene } from "three";
import { RemoteResourceManager, loadRemoteResource, RemoteResourceLoader } from "./RemoteResourceManager";
import { ResourceDefinition, ResourceLoader, ResourceLoaderResponse, ResourceManager } from "./ResourceManager";


const boxGeometry = new BoxBufferGeometry();

export function MeshResourceLoader(manager: ResourceManager): ResourceLoader<ResourceDefinition, Mesh> {  
  return {
    type: "mesh",
    async load({ name, color }): Promise<ResourceLoaderResponse<Mesh>> {
      return {
        name,
        resource: new Mesh(boxGeometry, new MeshBasicMaterial({ wireframe: true, color })),
      };
    }
  };
}

export function MeshRemoteResourceLoader(manager: RemoteResourceManager): RemoteResourceLoader {
  return {
    type: "mesh",
  };
}

export function loadRemoteMesh(
  manager: RemoteResourceManager,
  color: number,
  name?: string,
): number {
  return loadRemoteResource(manager, {
    type: "mesh",
    name,
    color,
  });
}
