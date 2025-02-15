import is from '@sindresorhus/is';
import upath from 'upath';
import yaml from 'js-yaml';

import { logger } from '../../logger';
import { PackageFile, PackageDependency } from '../common';
import { platform } from '../../platform';

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile> {
  try {
    const baseDir = upath.parse(fileName).dir;
    const chartFileName = upath.join(baseDir, 'Chart.yaml');
    const chartContents = await platform.getFile(chartFileName);
    if (!chartContents) {
      logger.debug({ fileName }, 'Failed to find helm Chart.yaml');
      return null;
    }
    const chart = yaml.safeLoad(chartContents);
    if (!(chart && chart.apiVersion && chart.name && chart.version)) {
      logger.debug(
        { fileName },
        'Failed to find required fields in Chart.yaml'
      );
      return null;
    }
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm Chart.yaml');
    return null;
  }
  let deps = [];
  let doc;
  try {
    doc = yaml.safeLoad(content);
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm requirements.yaml');
    return null;
  }
  if (!(doc && is.array(doc.dependencies))) {
    logger.debug({ fileName }, 'requirements.yaml has no dependencies');
    return null;
  }
  deps = doc.dependencies.map(dep => {
    const res: PackageDependency = {
      depName: dep.name,
      currentValue: dep.version,
      registryUrls: [dep.repository],
    };
    const url = new URL(dep.repository);
    if (url.protocol === 'file:') {
      res.skipReason = 'local-dependency';
    }
    return res;
  });
  const res = {
    deps,
    datasource: 'helm',
  };
  return res;
}
