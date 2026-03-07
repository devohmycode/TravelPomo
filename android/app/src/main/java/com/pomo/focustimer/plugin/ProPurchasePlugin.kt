package com.pomo.focustimer.plugin

import android.util.Log
import com.android.billingclient.api.*
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ProPurchase")
class ProPurchasePlugin : Plugin() {

    companion object {
        private const val TAG = "ProPurchase"
        private const val PRODUCT_ID = "travelpomo_pro"
    }

    private var billingClient: BillingClient? = null
    private var pendingCall: PluginCall? = null

    override fun load() {
        billingClient = BillingClient.newBuilder(context)
            .setListener { billingResult, purchases ->
                handlePurchaseResult(billingResult, purchases)
            }
            .enablePendingPurchases()
            .build()
    }

    private fun ensureConnected(onReady: () -> Unit, onFail: (String) -> Unit) {
        val client = billingClient ?: run {
            onFail("Billing client not initialized")
            return
        }

        if (client.isReady) {
            onReady()
            return
        }

        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    onReady()
                } else {
                    onFail("Billing setup failed: ${result.debugMessage}")
                }
            }

            override fun onBillingServiceDisconnected() {
                Log.w(TAG, "Billing service disconnected")
            }
        })
    }

    @PluginMethod
    fun checkPro(call: PluginCall) {
        ensureConnected(
            onReady = { queryPurchases(call) },
            onFail = { msg ->
                Log.w(TAG, msg)
                val ret = JSObject()
                ret.put("isPro", false)
                call.resolve(ret)
            }
        )
    }

    @PluginMethod
    fun purchasePro(call: PluginCall) {
        ensureConnected(
            onReady = { launchBillingFlow(call) },
            onFail = { msg ->
                Log.e(TAG, msg)
                val ret = JSObject()
                ret.put("success", false)
                ret.put("error", msg)
                call.resolve(ret)
            }
        )
    }

    @PluginMethod
    fun restorePurchase(call: PluginCall) {
        ensureConnected(
            onReady = { queryPurchases(call) },
            onFail = { msg ->
                Log.w(TAG, msg)
                val ret = JSObject()
                ret.put("isPro", false)
                call.resolve(ret)
            }
        )
    }

    private fun queryPurchases(call: PluginCall) {
        val client = billingClient ?: return

        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build()

        client.queryPurchasesAsync(params) { billingResult, purchases ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                val hasPro = purchases.any {
                    it.products.contains(PRODUCT_ID) &&
                    it.purchaseState == Purchase.PurchaseState.PURCHASED
                }

                // Acknowledge any unacknowledged purchases
                purchases.filter {
                    it.products.contains(PRODUCT_ID) &&
                    it.purchaseState == Purchase.PurchaseState.PURCHASED &&
                    !it.isAcknowledged
                }.forEach { purchase ->
                    val ackParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.purchaseToken)
                        .build()
                    client.acknowledgePurchase(ackParams) { ackResult ->
                        Log.d(TAG, "Acknowledge result: ${ackResult.responseCode}")
                    }
                }

                val ret = JSObject()
                ret.put("isPro", hasPro)
                call.resolve(ret)
            } else {
                val ret = JSObject()
                ret.put("isPro", false)
                call.resolve(ret)
            }
        }
    }

    private fun launchBillingFlow(call: PluginCall) {
        val client = billingClient ?: return

        pendingCall = call

        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_ID)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
            if (billingResult.responseCode != BillingClient.BillingResponseCode.OK || productDetailsList.isEmpty()) {
                pendingCall = null
                val ret = JSObject()
                ret.put("success", false)
                ret.put("error", "Product not found")
                call.resolve(ret)
                return@queryProductDetailsAsync
            }

            val productDetails = productDetailsList[0]
            val flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)
                            .build()
                    )
                )
                .build()

            val activity = this.activity ?: run {
                pendingCall = null
                val ret = JSObject()
                ret.put("success", false)
                ret.put("error", "No activity")
                call.resolve(ret)
                return@queryProductDetailsAsync
            }

            client.launchBillingFlow(activity, flowParams)
        }
    }

    private fun handlePurchaseResult(billingResult: BillingResult, purchases: List<Purchase>?) {
        val call = pendingCall ?: return
        pendingCall = null

        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            val proPurchase = purchases.find {
                it.products.contains(PRODUCT_ID) &&
                it.purchaseState == Purchase.PurchaseState.PURCHASED
            }

            if (proPurchase != null) {
                // Acknowledge
                if (!proPurchase.isAcknowledged) {
                    val ackParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(proPurchase.purchaseToken)
                        .build()
                    billingClient?.acknowledgePurchase(ackParams) { ackResult ->
                        Log.d(TAG, "Purchase acknowledged: ${ackResult.responseCode}")
                    }
                }

                val ret = JSObject()
                ret.put("success", true)
                call.resolve(ret)
                return
            }
        }

        val ret = JSObject()
        ret.put("success", false)
        if (billingResult.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            ret.put("error", "cancelled")
        } else {
            ret.put("error", billingResult.debugMessage)
        }
        call.resolve(ret)
    }

    override fun handleOnDestroy() {
        billingClient?.endConnection()
        billingClient = null
        super.handleOnDestroy()
    }
}
