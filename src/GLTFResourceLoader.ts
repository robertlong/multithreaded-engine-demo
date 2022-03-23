import { Object3D, Scene } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ResourceDefinition, ResourceLoader, ResourceManager } from "./ResourceManager";

interface GLTFResourceDef extends ResourceDefinition {
  url: string;
}

export function createGLTFResourceLoader(scene: Scene) {
  return function GLTFResourceLoader(manager: ResourceManager): ResourceLoader<GLTFResourceDef, Object3D> {
    const gltfLoader = new GLTFLoader();
  
    return {
      type: "gltf",
      async load(resourceDef: GLTFResourceDef) {
        const gltf = await gltfLoader.loadAsync(resourceDef.url);
        scene.add(gltf.scene);
        return gltf.scene;
      },
      dispose({ resource }) {
        if (resource) {
          scene.remove(resource);
        }
      }
    }
  }
}

