# Use official Node.js LTS image
FROM node:23-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (for better caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the app's source code
COPY . .

# Expose port 4000 to the outside world
EXPOSE 4000

# Start the app
CMD ["node", "index.js"]
