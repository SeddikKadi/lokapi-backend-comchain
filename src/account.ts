import { t } from '@lokavaluto/lokapi'

import { ComchainRecipient } from "./recipient"

import { BridgeObject } from '@lokavaluto/lokapi/build/backend'


export class ComchainAccount extends BridgeObject implements t.IAccount {

    async getBalance () {
        const cc = this.backends.comchain
        const wid = this.parent.jsonData.wallet.address
        return await cc.bcRead[`get${this.jsonData.comchain.type}Balance`](wid)
    }

    async getSymbol () {
        return this.backends.comchain.customization.getCurrencies()['CUR']
    }

    get internalId () {
        return `${this.parent.internalId}/${this.parent.address}/${this.jsonData.comchain.type}`
    }

    public async transfer (recipient: ComchainRecipient, amount: number, description: string) {
        // On comchain, account transfer is managed through the owner account
        return recipient.transfer(amount, description)
    }


    /**
     * get URL to Credit given amount on current account
     *
     * @throws {RequestFailed, APIRequestFailed, InvalidCredentials, InvalidJson}
     *
     * @returns Object
     */
    public async getCreditUrl (amount: number): Promise<string> {
        return this.backends.odoo.$post('/comchain/credit', {
            owner_id: this.parent.ownerId,
            amount,
        })
    }

}
