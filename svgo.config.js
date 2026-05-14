export default {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          cleanupIds: false,
          mergePaths: false,
          convertShapeToPath: false,
          convertPathData: false,
          removeHiddenElems: false,
          collapseGroups: false,
          inlineStyles: false,
          minifyStyles: false,
        },
      },
    },
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'removeXMLProcInst',
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'removeUnusedNS',
  ],
};
