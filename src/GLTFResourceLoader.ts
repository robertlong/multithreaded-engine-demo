import { Object3D, Scene } from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RemoteResourceManager, loadRemoteResource, RemoteResourceLoader } from "./RemoteResourceManager";
import { ResourceDefinition, ResourceLoader, ResourceLoaderResponse, ResourceManager } from "./ResourceManager";

interface GLTFResourceDef extends ResourceDefinition {
  url: string;
}

export function GLTFResourceLoader(manager: ResourceManager): ResourceLoader<GLTFResourceDef, Object3D> {
  const gltfLoader = new GLTFLoader();

  return {
    type: "gltf",
    async load({ name, url }) {
      console.log(`RenderThread load ${url}`);

      const { scene } = await gltfLoader.loadAsync(url);

      return {
        name,
        resource: scene
      };
    }
  };
}

export function GLTFRemoteResourceLoader(manager: RemoteResourceManager): RemoteResourceLoader {
  return {
    type: "gltf"
  };
}

export function loadRemoteGLTF(
  manager: RemoteResourceManager,
  url: string,
  name?: string,
): number {
  return loadRemoteResource(manager, {
    type: "gltf",
    url,
    name,
  });
}
