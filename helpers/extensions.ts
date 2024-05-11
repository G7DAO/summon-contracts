import { CONTRACT_EXTENSION_NAME } from "@constants/contract";

export interface ExtensionMetadata {
    name: string;
    metadataURI: string;
    implementation: string;
}

export interface ExtensionFunction {
    functionSelector: string;
    functionSignature: string;
}

export interface Extension {
    metadata: ExtensionMetadata;
    functions: ExtensionFunction[];
}

export interface DeployedExtension extends Extension {
    abi: any;
    name: CONTRACT_EXTENSION_NAME;
}

export enum ExtensionAction {
    ADD = 'add',
    REMOVE = 'remove',
    REPLACE = 'replace',
}

export interface ExtensionDeployment {
    abi: any;
    address: string;
    functions: ExtensionFunction[];
    name: CONTRACT_EXTENSION_NAME;
}
