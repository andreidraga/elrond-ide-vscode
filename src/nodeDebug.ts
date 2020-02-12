import os = require('os');
import { FsFacade, ProcessFacade, RestFacade as RequestsFacade } from "./utils";
import { MySettings } from "./settings";
import eventBus from "./eventBus";
import path = require('path');
import { Feedback } from "./feedback";
import { Erdpy } from './erdpy';

export class NodeDebug {

    public static start() {
        Erdpy.require();

        let workspaceFolder = FsFacade.getPathToWorkspace();

        ProcessFacade.execute({
            program: "erdpy",
            workingDirectory: workspaceFolder,
            args: ["nodedebug"],
            eventTag: "debugger",
            channels: ["debugger"]
        })
            .catch(() => { })
            .finally(() => {
                Feedback.info("node-debug stopped.");
            });

        eventBus.emit("debugger:started");
        Feedback.info("node-debug started.");
    };

    public static async stop(): Promise<any> {
        await Erdpy.require();
        
        return ProcessFacade.execute({
            program: "erdpy",
            args: ["nodedebug", "--stop"],
            eventTag: "debugger",
            channels: ["debugger"]
        });
    }

    public static async deploySmartContract(options: any): Promise<any> {
        let url = NodeDebug.buildUrl("vm-values/deploy");

        try {
            let response = await RequestsFacade.post({
                url: url,
                data: {
                    "OnTestnet": options.onTestnet,
                    "PrivateKey": options.privateKey,
                    "TestnetNodeEndpoint": MySettings.getTestnetUrl(),
                    "SndAddress": options.senderAddress,
                    "Value": options.value.toString(),
                    "GasLimit": options.gasLimit,
                    "GasPrice": options.gasPrice,
                    "TxData": options.transactionData
                },
                eventTag: "debugger-dialogue",
                channels: ["debugger-dialogue"]
            });

            if (response.error) {
                Feedback.error(`Deploy error: ${response.error}`);
                return {};
            }

            return response.data;
        }
        catch (e) {
            Feedback.error(`Cannot deploy. Please see output channels.`);
            throw e;
        }
    }

    public static async runSmartContract(runOptions: any): Promise<any> {
        let url = NodeDebug.buildUrl("vm-values/run");

        try {
            let response = await RequestsFacade.post({
                url: url,
                data: {
                    "OnTestnet": runOptions.onTestnet,
                    "PrivateKey": runOptions.privateKey,
                    "TestnetNodeEndpoint": MySettings.getTestnetUrl(),
                    "SndAddress": runOptions.senderAddress,
                    "ScAddress": runOptions.scAddress,
                    "Value": runOptions.value.toString(),
                    "GasLimit": runOptions.gasLimit,
                    "GasPrice": runOptions.gasPrice,
                    "TxData": runOptions.transactionData
                },
                eventTag: "debugger-dialogue",
                channels: ["debugger-dialogue"]
            });

            if (response.error) {
                Feedback.error(`Run error: ${response.error}`);
                return {};
            }

            let vmOutput: any = response.data;

            if (runOptions.onTestnet) {
            } else {
                NodeDebug.postProcessVMOutput(vmOutput);
            }

            return vmOutput;
        } catch (e) {
            Feedback.error(`Cannot deploy. Please see output channels.`);
            throw e;
        }
    }

    public static async querySmartContract(options: any): Promise<any> {
        let url = NodeDebug.buildUrl("vm-values/query");

        return await RequestsFacade.post({
            url: url,
            data: {
                "OnTestnet": options.onTestnet,
                "TestnetNodeEndpoint": MySettings.getTestnetUrl(),
                "ScAddress": options.scAddress,
                "FuncName": options.functionName,
                "Args": options.arguments
            },
            eventTag: "debugger-dialogue"
        }).catch(e => {
            Feedback.error(`Cannot run. Please see output channels.`);
            throw e;
        });
    }

    private static buildUrl(relative: string) {
        let port: any = MySettings.getRestDebuggerPort();
        return `http://localhost:${port}/${relative}`;
    }

    public static postProcessVMOutput(vmOutput: any) {
        let returnData: any[] = vmOutput.ReturnData || [];
        vmOutput.ReturnDataHex = [];
        vmOutput.ReturnDataDecimal = [];
        vmOutput.ReturnDataString = [];

        returnData.forEach(function (data: any) {
            var dataHex = Buffer.from(data, "base64").toString("hex");
            var dataInt = parseInt(dataHex, 16);
            var dataString = Buffer.from(data, "base64").toString();
            vmOutput.ReturnDataHex.push(dataHex);
            vmOutput.ReturnDataDecimal.push(dataInt);
            vmOutput.ReturnDataString.push(dataString);
        });

        let outputAccounts: any[] = vmOutput.OutputAccounts || [];

        outputAccounts.forEach(function (account: any) {
            account.Address = Buffer.from(account.Address, "base64").toString("hex");

            let storageUpdates: any[] = account.StorageUpdates || [];

            storageUpdates.forEach(function (update) {
                update.DataHex = Buffer.from(update.Data, "base64").toString("hex");
                update.DataDecimal = parseInt(update.DataHex, 16);
                update.Offset = Buffer.from(update.Offset, "base64").toString("hex");
            });
        });

        return vmOutput;
    }

    public static getFolderPath(): string {
        let idePath = MySettings.getIdeFolder();
        let subfolder = path.join(idePath, "nodedebug");
        return subfolder;
    }

    public static getToolPath(): string {
        let toolPath = path.join(NodeDebug.getFolderPath(), "nodedebug");
        return toolPath;
    }
}
