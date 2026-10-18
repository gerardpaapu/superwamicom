FROM ghcr.io/voidzero-dev/vite-plus:1.3.0 AS builder
WORKDIR /app
USER vp
COPY --chown=vp:vp package.json pnpm-lock.yaml* pnpm-workspace.yaml package-lock.json* yarn.lock* ./

# Vite+ automatically detects and manages the package manager
RUN vp install

COPY --chown=vp:vp . .
RUN vp build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]