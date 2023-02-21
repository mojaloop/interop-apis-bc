FROM node:18.13.0-alpine AS builder

# Create the project directory inside the container.
WORKDIR /app

RUN apk add --no-cache -t build-dependencies git make gcc g++ python3 libtool autoconf pkgconfig automake bash # wget tar xz

RUN cd $(npm root -g)/npm
RUN npm config set unsafe-perm true
RUN npm install -g node-gyp

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY packages/fspiop-utils-lib/package*.json ./packages/fspiop-utils-lib/
COPY packages/fspiop-api-svc/package*.json ./packages/fspiop-api-svc/

# If you are building your code for production
#RUN npm ci --only=production
RUN npm install

########################################
# Copy code and build

# root tsconfig.json
COPY tsconfig.json ./

# copy required supporting packages/packages (especially private ones not published to npm)
COPY packages/fspiop-utils-lib ./packages/fspiop-utils-lib

# copy service code
COPY packages/fspiop-api-svc ./packages/fspiop-api-svc

# build
RUN npm run build

RUN ls -la ./packages/fspiop-api-svc/dist


FROM node:18.13-alpine
WORKDIR /app

COPY --from=builder /app .

# kafka handler, no http server yet
EXPOSE 3202

CMD [ "npm", "run", "start:fspiop-api-svc" ]
