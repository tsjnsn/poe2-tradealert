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
const dnsZoneName = "poe2-com-zone";

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

// Create API Gateway
const api = new gcp.apigateway.Api(apiGatewayName, {
    apiId: apiGatewayName,
});

// Load and process the OpenAPI configuration
const loadOpenApiConfig = (serviceUri: pulumi.Output<string>): pulumi.Output<string> => {
    return serviceUri.apply(uri => {
        const configPath = path.join(__dirname, 'api-gateway-config.yaml');
        let configContent = fs.readFileSync(configPath, 'utf8');
        
        // Ensure the service URI is correctly replaced
        configContent = configContent.replace(/\$\{service_uri\}/g, uri); // Use regex to replace all instances
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

// DNS Configuration
const domainName = "poe2.com";
const apiSubdomain = "api.tradealert";
const fullDomain = `${apiSubdomain}.${domainName}`;

// Update the gateway configuration with custom domain
const gateway = new gcp.apigateway.Gateway(`${apiGatewayName}`, {
    apiConfig: apiConfig.id,
    region: region,
    gatewayId: apiGatewayName,
    displayName: fullDomain,
});


// Update API Gateway with custom domain
const gatewayDomain = new gcp.apigateway.GatewayIamMember(`${apiGatewayName}-domain`, {
    gateway: gateway.gatewayId,
    role: "roles/apigateway.admin",
    member: pulumi.interpolate`serviceAccount:${gatewayServiceAccount.email}`,
});

const dnsZone = gcp.dns.ManagedZone.get(dnsZoneName, dnsZoneName);

// Reference the new DNS zone instead of the existing one
const dnsRecord = new gcp.dns.RecordSet(`${apiGatewayName}-record`, {
    name: `tradealert-api.poe2.com.`,
    managedZone: dnsZone.name,
    type: "CNAME",
    ttl: 300,
    rrdatas: [pulumi.interpolate`${gateway.defaultHostname}.`],
});

// Allow only API Gateway to invoke the service
const iamPolicy = new gcp.cloudrunv2.ServiceIamPolicy(`${serviceName}-policy`, {
    location: service.location,
    project: service.project,
    name: service.name,
    policyData: gatewayServiceAccount.email.apply(email => 
        JSON.stringify({
            bindings: [{
                role: "roles/run.invoker",
                members: [
                    `serviceAccount:${email}`
                ],
            }],
        })
    ),
});

// Export useful variables
export const cloudRunUrl = service.uri;
export const apiGatewayUrl = pulumi.interpolate`https://${gateway.defaultHostname}`;
export const customDomainUrl = pulumi.interpolate`https://${fullDomain}`;
export const nameServers = dnsZone.nameServers;
export const gatewayCname = gateway.defaultHostname;