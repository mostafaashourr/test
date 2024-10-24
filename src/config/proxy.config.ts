import * as dotenv from 'dotenv';

dotenv.config();

export const PROXY_ROUTES: Array<{
  path: string;
  method: string;
  proxy: {
    target: string;
    changeOrigin: boolean;
    pathRewrite: { [key: string]: string };
  };
}> = [];

// Read the JSON string from the environment variable
const proxyRoutesJson = process.env.PROXY_ROUTES;

if (proxyRoutesJson) {
  try {
    // Parse the JSON string into an object
    const routes = JSON.parse(proxyRoutesJson);

    // Validate and push the routes into PROXY_ROUTES
    if (Array.isArray(routes)) {
      routes.forEach(
        (route: { path: string; target: string; method: string }) => {
          if (route.path && route.target && route.method) {
            PROXY_ROUTES.push({
              path: route.path,
              method: route.method,
              proxy: {
                target: route.target,
                changeOrigin: true,
                pathRewrite: { [`^${route.path}`]: '' },
              },
            });
          } else {
            console.error('Invalid route configuration:', route);
          }
        },
      );
    } else {
      console.error('PROXY_ROUTES_JSON is not an array:', routes);
    }
  } catch (error) {
    console.error('Error parsing PROXY_ROUTES_JSON:', error.message);
  }
} else {
  console.error('PROXY_ROUTES_JSON environment variable is not set.');
}
