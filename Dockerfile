FROM docker-nexus.javelin.vodafone.com/node:18-alpine As development

# Create app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND yarn.lock (when available).
# Copying this first prevents re-running yarm install on every code change.
COPY --chown=node:node package.json ./
COPY --chown=node:node yarn.lock ./
COPY --chown=node:node .npmrc ./
COPY --chown=node:node  node_modules ./

# NPM_AUTH & SMAPI_AUTH args
ARG NPM_AUTH
ARG SMAPI_AUTH

ARG vfuk_token


# Install app dependencies
RUN yarn --update-checksums

# Bundle app source
COPY --chown=node:node . .

# Use the node user from the image (instead of the root user)
USER node

###################
# BUILD FOR PRODUCTION
###################

FROM docker-nexus.javelin.vodafone.com/node:18-alpine As build

# NPM_AUTH & SMAPI_AUTH args
ARG NPM_AUTH
ARG SMAPI_AUTH
ARG vfuk_token

WORKDIR /usr/src/app

COPY --chown=node:node package.json ./
COPY --chown=node:node yarn.lock ./

# In order to run `npm run build` we need access to the Nest CLI which is a dev dependency. In the previous development stage we ran yarn which installed all dependencies, so we can copy over the node_modules directory from the development image
COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules

COPY --chown=node:node . .

# Run the build command which creates the production bundle
# Specify application that will be built
# Replace below{{ MICROSERVICE_APPLICATION_NAME }} with the name of the application  in <root>/nest-cli.json projects
RUN yarn build

# Set NODE_ENV environment variable
ENV NODE_ENV production

# Running yarn removes the existing node_modules directory and passing in --production=true ensures that only the production dependencies are installed. This ensures that the node_modules directory is as optimized as possible
RUN yarn --production=true --update-checksums && yarn cache clean --force

USER node

###################
# PRODUCTION
###################

FROM docker-nexus.javelin.vodafone.com/node:18-alpine As production

ARG MICROSERVICE_APPLICATION_NAME


RUN apk add --update curl && \
    rm -rf /var/cache/apk/*


# Copy the bundled code from the build stage to the production image
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
# Replace below{{ MICROSERVICE_APPLICATION_NAME }} with the name of the application  in <root>/nest-cli.json projects
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Start the server using the production build
CMD [ "node", "dist/main.js" ]
