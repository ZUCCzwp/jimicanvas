import { requestJimiaigo } from './jimiaigoApi';

function chargeRequest(path, { method = 'GET', body, query } = {}) {
  return requestJimiaigo(path, {
    method,
    body,
    query,
    requireToken: true,
    dataOnly: false,
  });
}

export function getChargeList() {
  return chargeRequest('/api/charge/list', { method: 'GET' });
}

export function createOrder(data) {
  return chargeRequest('/api/charge/order/create', {
    method: 'POST',
    body: data,
  });
}

export function redeemCode(data) {
  return chargeRequest('/api/charge/redeem', {
    method: 'POST',
    body: data,
  });
}

export function checkOrderStatus(orderNo) {
  return chargeRequest('/api/charge/order/status', {
    method: 'GET',
    query: { order_no: orderNo },
  });
}
