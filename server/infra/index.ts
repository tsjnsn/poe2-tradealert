import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as docker from "@pulumi/docker";
import * as fs from "fs";
import * as path from "path";

// Load configuration
const config = new pulumi.Config();
const projectId = gcp.config.project || "";
const region = gcp.config.region || "us-central1";
const serviceName = "tradealert-service";
const apiGatewayName = "tradealert-gateway";
const projectRoot = path.join(__dirname, "..");

// Load environment variables from .env.production
const envVars: { [key: string]: string } = {};
try {
    const envFile = fs.readFileSync(path.join(projectRoot, ".env.production"), "utf8");
    envFile.split("\n").forEach(line => {
        if (line && !line.startsWith("#")) {
            const index = line.indexOf("=");
            if (index !== -1) {
                const key = line.substring(0, index).trim();
                const value = line.substring(index + 1).trim();
                envVars[key] = value;
            }
        }
    });
} catch (error) {
    console.warn("Warning: .env.production file not found");
}

// Create a Docker image from our app
const appImage = new docker.Image("app-image", {
    imageName: pulumi.interpolate`gcr.io/${projectId}/${serviceName}:latest`,
    build: {
        context: projectRoot,
        dockerfile: path.join(projectRoot, "Dockerfile"),
    },
});

// Deploy to Cloud Run (v2)
const service = new gcp.cloudrunv2.Service(serviceName, {
    location: region,
    template: {
        containers: [{
            image: appImage.imageName,
            envs: Object.entries(envVars).map(([key, value]) => ({
                name: key,
                value: value,
            })),
            resources: {
                limits: {
                    memory: "512Mi",
                    cpu: "1000m",
                },
            },
        }],
        timeout: "300s",
    },
});

// Allow unauthenticated access to the service
const iamPolicy = new gcp.cloudrunv2.ServiceIamPolicy(`${serviceName}-policy`, {
    location: service.location,
    project: service.project,
    name: service.name,
    policyData: JSON.stringify({
        bindings: [{
            role: "roles/run.invoker",
            members: ["allUsers"],
        }],
    }),
});

// Create API Gateway
const api = new gcp.apigateway.Api(apiGatewayName, {
    apiId: apiGatewayName,
});

// Load and process the OpenAPI configuration
const loadOpenApiConfig = (serviceUri: pulumi.Output<string>): pulumi.Output<string> => {
    return serviceUri.apply(uri => {
        const configPath = path.join(__dirname, 'api-gateway-config.yaml');
        let configContent = fs.readFileSync(configPath, 'utf8');
        // Replace the service URI placeholder
        configContent = configContent.replace('${service_uri}', uri);
        return Buffer.from(configContent).toString('base64');
    });
};

// Create a dedicated service account for API Gateway
const gatewayServiceAccount = new gcp.serviceaccount.Account(`${apiGatewayName}-sa`, {
    accountId: pulumi.interpolate`${apiGatewayName}-sa`,
    displayName: "Service Account for API Gateway",
    description: "Used by API Gateway to invoke Cloud Run services",
});

// Grant the service account permission to invoke Cloud Run
const invokerBinding = new gcp.cloudrun.IamMember(`${serviceName}-invoker`, {
    location: service.location,
    service: service.name,
    role: "roles/run.invoker",
    member: pulumi.interpolate`serviceAccount:${gatewayServiceAccount.email}`,
});

const apiConfig = new gcp.apigateway.ApiConfig(`${apiGatewayName}-config`, {
    api: api.apiId,
    openapiDocuments: [{
        document: {
            path: "api-gateway-config.yaml",
            contents: pulumi.interpolate`${loadOpenApiConfig(service.uri)}`,
        },
    }],
    gatewayConfig: {
        backendConfig: {
            googleServiceAccount: gatewayServiceAccount.email,
        },
    },
});

const gateway = new gcp.apigateway.Gateway(`${apiGatewayName}`, {
    apiConfig: apiConfig.id,
    region: region,
    gatewayId: apiGatewayName,
});

// Export useful variables
export const cloudRunUrl = service.uri;
export const apiGatewayUrl = pulumi.interpolate`https://${gateway.defaultHostname}`; 