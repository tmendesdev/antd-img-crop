import replace from '@rollup/plugin-replace';
import babel from 'rollup-plugin-babel';
import less from 'rollup-plugin-less';
import pkg from './package.json';

const input = 'src/index.jsx';
const deps = [...Object.keys(pkg.peerDependencies), ...Object.keys(pkg.dependencies)];
const external = (id) => deps.includes(id) || /antd\/|@babel\/runtime\//.test(id);
const plugins = (isCjs) => [
  isCjs && replace({ '/es/': '/lib/' }),
  babel({
    plugins: [['@babel/plugin-transform-runtime', { useESModules: !isCjs }]],
    runtimeHelpers: true,
  }),
  less({ insert: true, output: false }),
];

export default [
  { input, output: { file: pkg.main, format: 'cjs' }, external, plugins: plugins(true) },
  { input, output: { file: pkg.module, format: 'es' }, external, plugins: plugins(false) },
];
