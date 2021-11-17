import { t } from '@lokavaluto/lokapi'
import { Contact } from '@lokavaluto/lokapi/build/backend/odoo/contact'

import { ComchainPayment } from './payment'


export class ComchainRecipient extends Contact implements t.IRecipient {

    get backendId () {
        return this.parent.internalId
    }

    public async transfer (amount: number, description: string) {
        // XXXvlab: yuck, there need to be a clean up and rationalisation
        //   of these backends and jsonData link madness
        const lokapi = this.backends.odoo
        const comchain = this.backends.comchain
        const jsc3l = this.parent.jsc3l
        const wallet = comchain.jsonData.wallet
        const destAddress = this.jsonData.comchain.address
        const messageKey = await jsc3l.ajaxReq.getMessageKey(
            `0x${destAddress}`, false)

        const data = jsc3l.memo.getTxMemoCipheredData(
            wallet.message_key.pub, messageKey.public_message_key,
            description, description
        )

        let password, clearWallet
        let state = 'firstTry'
        while (true) {
            password = await this.parent.requestLocalPassword(state)
            try {
                clearWallet = jsc3l.wallet.getWalletFromPrivKeyFile(
                    JSON.stringify(wallet), password)
                break
            } catch (e) {
                state = 'failedUnlock'
                console.log('Failed to unlock wallet', e)
            }
        }
        const jsonData = await jsc3l.bcTransaction.transferNant(
            clearWallet, destAddress, amount, data)

        return new ComchainPayment({ comchain: this.backends.comchain }, this, {
            comchain: jsonData,
        })
    }

    get internalId () {
        return `${this.parent.internalId}/${this.backends.comchain.owner_id}`
    }

}
