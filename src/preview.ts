import * as vscode from 'vscode';
import * as child from 'child_process';
import * as fs from 'fs';
import { SignalDispatcher } from 'ste-signals';
import { PreviewStore } from './previewStore';

var commandExists = require('command-exists');

export type PreviewType = 'view'|'output';

// Preview class to open instance of OpenSCAD
export class Preview {
    // Paths
    private static _scadPath: string;
    private static _isValidScadPath: boolean;
    private readonly _fileUri: vscode.Uri;
    private readonly _process: child.ChildProcess;
    private readonly _previewType: PreviewType;
    private _isRunning: boolean;
    private _onKilled = new SignalDispatcher();

    // Constructor
    private constructor(fileUri: vscode.Uri, previewType?: PreviewType, args?: string[] | undefined) {
        // Set local arguments
        this._fileUri = fileUri;
        this._previewType = (previewType ? previewType : 'view');

        const commandArgs: string[] = (args) ? args.concat(this._fileUri.fsPath) : [this._fileUri.fsPath];

        console.log(`commangArgs: ${commandArgs}`); // DEBUG

        // New process
        this._process = child.spawn(Preview._scadPath, commandArgs);

        // Set exit conditions or something like that
        this._process.stdout.on('data', (data) => {
            console.log(data.toString());
        });
          
        this._process.stderr.on('data', (data) => {
            console.error(data.toString());
            vscode.window.showErrorMessage(`Error: ${data.toString()}`);
        });
        
        // Run on child exit
        this._process.on('exit', (code) => {
            console.log(`Child exited with code ${code}`);
            this._isRunning = false;
            this._onKilled.dispatch();  // Dispatch 'onKilled' event
        });

        // Child process is now running
        this._isRunning = true;
    }

    // Kill child process
    public dispose() {
        if (this._isRunning) this._process.kill();
        // this._isRunning = false;
    }

    // Returns if the given Uri is equivalent to the preview's Uri
    public matchUri(uri: vscode.Uri, previewType?: PreviewType): boolean {
        return (this._fileUri.toString() === uri.toString()) && (this._previewType === (previewType ? previewType : 'view'));
    }

    // Return Uri
    public get uri(): vscode.Uri { return this._fileUri; }

    // Get if running
    public get isRunning(): boolean { return this._isRunning; }

    // On killed handlers
    public get onKilled() {
        return this._onKilled.asEvent();
    }

    // Static factory method. Create new preview child process
    // Needed to make sure path to `openscad.exe` is defined
    public static create(resource: vscode.Uri, previewType?: PreviewType, args?: string[]): Preview | undefined {
        // Error checking
        // Make sure scad path is defined
        if (!Preview._scadPath) {
            console.error("OpenSCAD path is undefined in config");
            vscode.window.showErrorMessage("OpenSCAD path does not exist.");
            return undefined;
        }
        
        // If previewType is undefined, automatically assign it based on arguemnts
        if(!previewType) previewType = args?.some(item => ['-o', '--o'].includes(item)) ? 'output' : 'view';

        // New file
        return new Preview(resource, previewType, args);
        
    }

    public get previewType() { return this._previewType; }

    // Used to set the path to `openscad.exe` on the system. Necessary to open children
    // TODO: Config is override. Autodetects path by OS otherwise
    public static set scadPath(scadPath: string) {
        Preview._scadPath = scadPath;
        console.log(`Path: '${this._scadPath}'`);   // DEBUG
        this._isValidScadPath = false;  // Set to false until can test if the command exists
        commandExists(Preview._scadPath, (err: boolean) => { this._isValidScadPath = !err });
    }

    public static get scadPath(): string { return Preview._scadPath; }
    public static get isValidScadPath() : boolean { return this._isValidScadPath; }
}