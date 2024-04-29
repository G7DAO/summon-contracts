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
