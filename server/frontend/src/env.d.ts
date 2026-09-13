// bun's bundler inlines `process.env.NODE_ENV` for the browser: "production"
// in the built bin, "development" from source. Nothing else of `process`
// exists here.
declare const process: { env: { NODE_ENV?: string } };

// Side-effect stylesheet imports: bun bundles them into the page's CSS.
declare module '*.css';

// CSS modules: bun hashes the class names and hands back the map.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
