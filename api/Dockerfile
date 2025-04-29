FROM node:20-alpine

WORKDIR /app

# Copy API package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy source files
COPY . .

# Create a TypeScript config that outputs directly to dist-node/api
RUN echo '{"compilerOptions":{"target":"ES2020","module":"NodeNext","moduleResolution":"NodeNext","esModuleInterop":true,"outDir":"dist-node/api","skipLibCheck":true},"include":["*.ts"]}' > tsconfig.json

# Build TypeScript code
RUN npm run build

# Create the directory structure if it doesn't exist
RUN mkdir -p dist-node/api

# Copy the compiled JS file to the expected location
RUN if [ -f "dist-node/api/presign.js" ]; then echo "File exists"; else cp presign.js dist-node/api/ || echo "Copy failed"; fi

# List files to debug
RUN ls -la && ls -la dist-node && ls -la dist-node/api || echo "Directory not found"

# Expose the port the app runs on
ENV PORT 8080
EXPOSE 8080

# Command to run the application
CMD ["node", "dist-node/api/presign.js"]
