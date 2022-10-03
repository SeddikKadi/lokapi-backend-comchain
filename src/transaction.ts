import { t } from '@lokavaluto/lokapi'
import { BridgeObject, Transaction } from '@lokavaluto/lokapi/build/backend'


export class ComchainTransaction extends Transaction implements t.ITransaction {

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
        if (this.parent.jsonData.message_key) {
            try {
                const data =
                    this.backends.comchain.jsc3l.memo.getTransactionMemo(
                        this.jsonData.comchain,
                        `0x${this.parent.jsonData.wallet.address}`,
                        this.parent.jsonData.message_key
                    )
                return data
            } catch (err) {
                console.error("Couldn't decipher transaction message.")
            }
        }
        return ''
    }

    get id () {
        return this.jsonData.comchain.hash
    }

    get related () {
        const direction = this.jsonData.comchain.direction === 2
        let add = this.jsonData.comchain[direction ? 'addr_from' : 'addr_to']
        if (add === 'Admin') {
            return 'Admin'
        }
        return this.jsonData.odoo[add.substring(2)]?.public_name || add
    }

}
