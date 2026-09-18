import fs from 'fs';
import path from 'path';
import { Document, NodeIO } from '@gltf-transform/core';
import { prune, dedup, weld, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';

async function optimizeModels() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  const rootDir = process.cwd();
  const modelsDir = path.join(rootDir, 'public', 'models');
  
  // Get all models in public/models
  const files = fs.readdirSync(modelsDir)
    .filter(f => f.endsWith('.gltf') || f.endsWith('.glb'))
    .map(f => path.join(modelsDir, f));
    
  // Also include the fallback model in public/
  const b777 = path.join(rootDir, 'public', 'b777_final.glb');
  if (fs.existsSync(b777)) {
    files.push(b777);
  }

  for (const filePath of files) {
    console.log(`Processing ${path.basename(filePath)}...`);
    try {
      const doc = await io.read(filePath);

      for (const mesh of doc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          prim.setMaterial(null);
        }
      }

      await doc.transform(
        prune(),
        dedup(),
        weld(),
        draco()
      );

      // Save as .glb
      const ext = path.extname(filePath);
      const newPath = filePath.substring(0, filePath.length - ext.length) + '.glb';
      await io.write(newPath, doc);
      
      // If it was originally a .gltf, remove the .gltf
      if (ext === '.gltf' && filePath !== newPath) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error(`Error processing ${path.basename(filePath)}:`, e.message);
    }
  }
}

optimizeModels().catch(console.error);
