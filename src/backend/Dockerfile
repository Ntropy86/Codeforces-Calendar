FROM node:20-slim

WORKDIR /usr/src/app

# Copy lockfile + manifest first so the install layer caches independently
# of source changes.
COPY package*.json ./

# `npm ci` respects the lockfile verbatim — faster and more deterministic
# than `npm install`, which is the behaviour we want in both CI and the
# production image. docker-compose for local dev overrides CMD to run
# nodemon against the bind-mounted source, so devDependencies need to ship.
RUN npm ci

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
