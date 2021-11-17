import { t } from '@lokavaluto/lokapi'
import { BridgeObject } from '@lokavaluto/lokapi/build/backend'


export class ComchainTransaction extends BridgeObject implements t.ITransaction {

    get amount () {
        return (this.jsonData.comchain.amount / 100.0).toString()
    }

    get currency () {
        return this.backends.comchain.customization.cfg.server.currencies.CUR
    }

    get date () {
        return new Date(this.jsonData.comchain.time * 1000)
    }

    get description () {
        const data = this.backends.comchain.jsc3l.memo.getTransactionMemo(
            this.jsonData.comchain, `0x${this.parent.jsonData.wallet.address}`,
            this.parent.jsonData.message_key)
        return data
    }

    get id () {
        return this.jsonData.comchain.hash
    }

    get related () {
        const add = this.jsonData.comchain.addr_to.substring(2)
        return this.jsonData.odoo[add].display_name
    }

    get relatedUser () {
        const add = this.jsonData.comchain.addr_to.substring(2)
        return { display: this.jsonData.odoo[add].display_name }
    }

}
