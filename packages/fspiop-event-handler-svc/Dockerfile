########################################
FROM node:20.10.0-alpine3.18 as builder

# Create the project directory inside the container.
WORKDIR /app

RUN apk add --no-cache -t build-dependencies git make gcc g++ python3 \
    libtool autoconf pkgconfig automake librdkafka-dev bash # wget tar xz

RUN cd $(npm root -g)/npm
#RUN npm config set unsafe-perm true
RUN npm install -g node-gyp

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY packages/fspiop-utils-lib/package*.json ./packages/fspiop-utils-lib/
COPY packages/fspiop-event-handler-svc/package*.json ./packages/fspiop-event-handler-svc/
COPY packages/fspiop-config-lib/package*.json ./packages/fspiop-config-lib/

# install devDependencies on builder image
RUN BUILD_LIBRDKAFKA=0 npm install

# Note on BUILD_LIBRDKAFKA:
#   Use BUILD_LIBRDKAFKA=0 only if we have installed librdkafka-dev in
#   the builder image and librdkafka in the final image

########################################
# Copy code and build

# root tsconfig.json
COPY tsconfig.json ./

# copy required supporting packages/packages (especially private ones not published to npm)
COPY packages/fspiop-utils-lib ./packages/fspiop-utils-lib
COPY packages/fspiop-config-lib ./packages/fspiop-config-lib

# copy service code
COPY packages/fspiop-event-handler-svc ./packages/fspiop-event-handler-svc

# build
RUN npm run build


FROM node:20.10.0-alpine3.18
WORKDIR /app
RUN mkdir /app/data

VOLUME /app/data/keys

RUN apk add librdkafka

COPY --from=builder /app .

# kafka handler, no http server yet
EXPOSE 4001

ENV NODE_ENV=production
CMD [ "node", "packages/fspiop-event-handler-svc/dist/index.js" ]
