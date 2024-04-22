export interface ExtensionMetadata {
    name: string;
    metadataURI: string;
    implementation: string;
}

export interface ExtensionFunction {
    selector: string;
    signature: string;
}

export interface Extension {
    metadata: ExtensionMetadata;
    functions: ExtensionFunction[];
}
