import { IStorageProvider } from "./storageProviderFactory";
import { IAsset, AssetType, StorageType } from "../../models/applicationState";
import { AssetService } from "../../services/assetService";
// import { Bounce } from "react-toastify";
import minioClient from "../../react/components/common/minioHandler/minioHandler";

// const minioClient = new minio.Client({
//     endPoint: "localhost",
//     port: 9000,
//     useSSL: false,
//     accessKey: "minio",
//     secretKey: "miniosecret"
// });

/**
 * Options for Minio Cloud Storage
 * @member folderName - Name of targeted container
 * @member createFolder - Option for creating container in `initialize()`
 */
export interface IMinioStorageOptions {
    folderName: string;
    createFolder: boolean;
    key?: string;
    secrect?: string;
}

export class MinioStorage implements IStorageProvider {
    /**
     * Storage type
     * @returns - StorageType.Cloud
     */
    public storageType: StorageType = StorageType.Cloud;

    constructor(private options?: IMinioStorageOptions) {}

    /**
     * Initialize connection to Minio Storage account & container
     * If `createBucket` was specified in options, this function
     * creates the container. Otherwise, validates that container
     * is contained in list of containers
     * @throws - Error if folder does not exist or not able to
     * connect to Minio Storage
     */
    public async initialize(): Promise<void> {
        const bucketName = this.options.folderName;
        if (this.options.createFolder) {
            await this.createContainer(bucketName);
        } else {
            const containers = await this.listFiles(bucketName);
            if (containers.length === 0) {
                throw new Error(`Container "${bucketName}" does not exist`);
            }
        }
    }

    /**
     * Reads text from specified blob
     * @param blobName - Name of blob in bucket
     */
    public async readText(blobName: string): Promise<string> {
        const url = await minioClient.presignedGetObject("raw", blobName);
        return await this.getText(url);
    }

    /**
     * Reads Buffer from specified blob
     * @param blobName - Name of blob in container
     */
    public async readBinary(blobName: string) {
        const text = await this.readText(blobName);
        return Buffer.from(text);
    }

    /**
     * Writes text to blob in container
     * @param blobName - Name of blob in container
     * @param content - Content to write to blob (string or Buffer)
     */
    public async writeText(blobName: string, content: string) {
        const etag = await minioClient.putObject("raw", blobName, content);
        // TODO: add user/tagger info to the assets
    }

    /**
     * Writes buffer to blob in container
     * @param blobName - Name of blob in container
     * @param content - Buffer to write to blob
     */
    public async writeBinary(blobName: string, content: Buffer) {
        const etag = await minioClient.putObject("raw", blobName, content);
    }

    /**
     * Deletes file from container
     * @param blobName - Name of blob in container
     */
    public async deleteFile(blobName: string): Promise<void> {
        minioClient.removeObject("raw", blobName, function(err) {
            if (err) {
                return console.log("Unable to remove object", err);
            }
            console.log("Removed the object: ", blobName);
        });
    }

    /**
     * Lists files in container
     * @param path - NOT USED IN CURRENT IMPLEMENTATION. Only uses container
     * as specified in Azure Cloud Storage Options. Included to satisfy
     * Storage Provider interface
     * @param ext - Extension of files to filter on when retrieving files
     * from container
     */
    public async listFiles(
        bucketName: string,
        prefix?: string
    ): Promise<string[]> {
        var assets = [];
        const objectsStream = minioClient.listObjects(bucketName, "", true);
        objectsStream.on("data", function(obj) {
            console.log(obj);
            var publicUrl = bucketName + "/" + obj.name;
            assets.push(publicUrl);
        });
        objectsStream.on("error", function(e) {
            console.log(e);
        });
        return assets;
    }

    /**
     * Lists containers with the Minio storage account
     * @param path - NOT USED IN CURRENT IMPLEMENTATION. Lists containers in storage account.
     * Path does not really make sense in this scenario. Included to satisfy interface
     */
    public async listContainers(path: string) {
        let result;
        minioClient.listBuckets(function(err, buckets) {
            if (err) return console.log(err);
            console.log("buckets :", buckets);
            result = result.push(buckets);
        });
        return result;
    }

    /**
     * Creates container specified in Minio Storage options
     * @param folderName - Container's bucket name to create
     */
    public async createContainer(bucketName: string): Promise<void> {
        try {
            await minioClient.makeBucket(bucketName, "us-east-1");
        } catch (e) {
            if (e.statusCode === 409) {
                return;
            }
            throw e;
        }
    }

    /**
     * Deletes folder specified in Minio
     * @param bucketName - Container's bucket name to delete
     */
    public async deleteContainer(bucketName: string): Promise<void> {
        await minioClient
            .removeBucket(bucketName)
            .then(function() {
                console.log("Bucket ${bucketName} deleted successfully");
            })
            .catch(function(error) {
                console.error(error);
            });
    }

    /**
     * Retrieves assets from Minio bucket folder
     * @param folderName - Container's folder from which to retrieve assets.
     */
    public async getAssets(folderName?: string): Promise<IAsset[]> {
        folderName = folderName ? folderName : this.options.folderName;
        const files = await this.listFiles(folderName);
        const result: IAsset[] = [];
        for (const file of files) {
            const url = await minioClient.presignedGetObject(folderName, file);
            const asset = AssetService.createAssetFromFilePath(
                url,
                this.getFileName(url)
            );
            if (asset.type !== AssetType.Unknown) {
                result.push(asset);
            }
        }
        return result;
    }

    public getFileName(url: string) {
        const pathParts = url.split("/");
        return pathParts[pathParts.length - 1].split("?")[0];
    }

    private async getObject(bucketName: string, objectName: string) {
        var size = 0;
        minioClient.getObject(bucketName, objectName, function(
            err,
            dataStream
        ) {
            if (err) {
                return console.log(err);
            }
            dataStream.on("data", function(chunk) {
                size += chunk.length;
            });
            dataStream.on("end", function() {
                console.log("End. Total size = " + size);
            });
            dataStream.on("error", function(err) {
                console.log(err);
            });
        });
    }

    private async getText(url: string) {
        const blob = await fetch(url).then(function(response) {
            return response.blob();
        });
        return await this.blobToString(blob);

        // const result = minioClient.getObject(
        //     this.options.folderName,
        //     blobName,
        //     function(err, dataStream) {
        //         if (err) {
        //             return console.log(err);
        //         }
        //         dataStream.on("data", function(chunk) {
        //             size += chunk.length;
        //             chunks.push(chunk);
        //         });
        //         dataStream.on("end", function() {
        //             console.log("End. Total size = " + size);
        //             const buffer = Buffer.concat(chunks);

        //             return buffer.toString();
        //         });
        //         dataStream.on("error", function(err) {
        //             console.log(err);
        //         });
        //     }
        // );
    }

    private async blobToString(blob: Blob): Promise<string> {
        const fileReader = new FileReader();

        return new Promise<string>((resolve, reject) => {
            fileReader.onloadend = (ev: any) => {
                resolve(ev.target!.result);
            };
            fileReader.onerror = reject;
            fileReader.readAsText(blob);
        });
    }
}
