import { IStorageProvider } from "./storageProviderFactory";
import { IAsset, AssetType, StorageType } from "../../models/applicationState";
import { AssetService } from "../../services/assetService";
import firebaseApp from "../../react/components/common/firebaseHandler/firebaseHandler";

const container = firebaseApp.storage();

/**
 * Options for Firebase Cloud Storage
 * @member folderName - Name of targeted container
 * @member createFolder - Option for creating container in `initialize()`
 * @member oauthToken - Not yet implemented. Optional token for accessing Firebase Storage
 */
export interface IFirebaseStorageOptions {
    folderName: string;
    createFolder: boolean;
    oauthToken?: string;
}

/**
 * Storage Provider for Firebase Storage
 */
export class FirebaseStorage implements IStorageProvider {
    /**
     * Storage type
     * @returns - StorageType.Cloud
     */
    public storageType: StorageType = StorageType.Cloud;

    constructor(private options?: IFirebaseStorageOptions) {}

    /**
     * Initialize connection to Firebase Storage account & container
     * If `createFolder` was specified in options, this function
     * creates the container. Otherwise, validates that container
     * is contained in list of containers
     * @throws - Error if folder does not exist or not able to
     * connect to Firebase Storage
     */
    public async initialize(): Promise<void> {
        const folderName = this.options.folderName;
        if (this.options.createFolder) {
            await this.createContainer(folderName);
        } else {
            const containers = await this.listFiles(folderName);
            if (containers.length === 0) {
                throw new Error(`Container "${folderName}" does not exist`);
            }
        }
    }

    /**
     * Reads text from specified blob
     * @param blobName - Name of blob in container
     */
    public async readText(blobName: string): Promise<string> {
        const Ref = this.getContainerURL().child(blobName);
        const downloadResponse = await Ref.getDownloadURL();
        return await this.getText(downloadResponse);
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
        const Ref = this.getContainerURL().child(blobName);
        // TODO: add user/tagger info to the assets
        // firebaseApp.auth().currentUser && firebaseApp.auth().currentUser.email;
        await Ref.putString(content);
    }

    /**
     * Writes buffer to blob in container
     * @param blobName - Name of blob in container
     * @param content - Buffer to write to blob
     */
    public async writeBinary(blobName: string, content: Buffer) {
        const Ref = this.getContainerURL().child(blobName);
        await Ref.put(content);
    }

    /**
     * Deletes file from container
     * @param blobName - Name of blob in container
     */
    public async deleteFile(blobName: string): Promise<void> {
        const Ref = this.getContainerURL().child(blobName);
        await Ref.delete();
    }

    /**
     * Lists files in container
     * @param path - NOT USED IN CURRENT IMPLEMENTATION. Only uses container
     * as specified in Azure Cloud Storage Options. Included to satisfy
     * Storage Provider interface
     * @param ext - Extension of files to filter on when retrieving files
     * from container
     */
    public async listFiles(path: string, ext?: string): Promise<string[]> {
        const result: string[] = [];
        const listRef = this.getContainerURL();
        await listRef.listAll().then(function(childlist) {
            childlist.items.forEach(function(fileRef) {
                if ((ext && fileRef.toString().endsWith(ext)) || !ext) {
                    result.push(
                        fileRef.toString().replace(listRef.toString() + "/", "")
                    );
                }
            });
        });
        return result;
    }

    /**
     * Lists containers with the Firebase storage account - not implemented for now
     * @param path - NOT USED IN CURRENT IMPLEMENTATION. Lists containers in storage account.
     * Path does not really make sense in this scenario. Included to satisfy interface
     */
    public async listContainers(path: string) {
        const result: string[] = [];
        return result;
    }

    /**
     * Creates container specified in Firebase Storage options
     * @param folderName - Container's folder name to create - Included to satisfy interface
     */
    public async createContainer(folderName: string): Promise<void> {
        // Need to create a file in the new directory in order to create the directory.
        const tmp_file = "foo.txt";
        const parts = [
            new Blob(["temporary file to create directory"], {
                type: "text/plain"
            }),
            "This is just a blob",
            new Uint16Array([33])
        ];

        // Construct a file
        const file = new File(parts, tmp_file);
        await this.getContainerURL()
            .child(tmp_file)
            .put(file);
    }

    /**
     * Deletes folder specified in Firebase
     * @param folderName - Container's folder name to delete - Included to satisfy interface
     */
    public async deleteContainer(folderName: string): Promise<void> {
        await this.getContainerURL()
            .delete()
            .then(function() {
                console.log("Container deleted successfully");
            })
            .catch(function(error) {
                console.error(error);
            });
    }

    /**
     * Retrieves assets from Firebase bucket folder
     * @param folderName - Container's folder from which to retrieve assets.
     */
    public async getAssets(folderName?: string): Promise<IAsset[]> {
        folderName = folderName ? folderName : this.options.folderName;
        const files = await this.listFiles(folderName);
        const result: IAsset[] = [];
        for (const file of files) {
            const url = file;
            const storageRef = await this.getContainerURL()
                .child(file)
                .getDownloadURL();
            const asset = AssetService.createAssetFromFilePath(
                storageRef,
                this.getFileName(url)
            );
            if (asset.type !== AssetType.Unknown) {
                result.push(asset);
            }
        }
        return result;
    }

    /**
     *
     * @param url - URL for Firebase
     */
    public getFileName(url: string) {
        const pathParts = url.split("/");
        return pathParts[pathParts.length - 1].split("?")[0];
    }

    private getContainerURL() {
        return container.ref(this.options.folderName);
    }

    private async getText(url) {
        const blob = await fetch(url).then(function(response) {
            return response.blob();
        });
        return await this.blobToString(blob);
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
