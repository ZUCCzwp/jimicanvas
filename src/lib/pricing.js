export function getUserPriceType(profile) {
  if (!profile) return 'standard';
  const roles = profile.roles || [];
  if (roles.includes('proxy') || roles.includes('agent')) {
    return 'agent_self';
  }
  if (profile.is_proxy_subordinate) {
    return 'proxy_sub';
  }
  if (profile.vip_info?.is_founding_member || profile.vip_info?.vip_type === 'founding') {
    return 'member';
  }
  return 'standard';
}

export function calculateCost(pricingList, modelName, profile) {
  if (!pricingList || !modelName) return 0;
  const p = pricingList.find(item => item.model_name === modelName);
  if (!p) return 0;

  const status = getUserPriceType(profile);
  const price = parseFloat(p.price) || 0;
  const proxyPrice = parseFloat(p.proxy_price) || 0;
  const memberPrice = parseFloat(p.member_price) || 0;

  if (status === 'agent_self' || status === 'proxy_sub') {
    return proxyPrice > 0 ? proxyPrice : price;
  }
  if (status === 'member') {
    const discounted = Math.round(price * 0.85 * 10000) / 10000;
    if (memberPrice > 0 && memberPrice < discounted) {
      return memberPrice;
    }
    return discounted;
  }
  return price;
}

export function resolveBillingModelName(node, options = {}) {
  const { hasVideoRefs = false } = options;

  if (node.type === 'image') {
    const model = node.imageModel || 'gpt-image-2';
    const resolution = String(node.imageResolution || '1k').toLowerCase();
    return `${model}-${resolution}`;
  }
  
  if (node.type === 'video') {
    const family = node.videoFamily || 'sora';
    const model = node.videoModel || (family === 'sora' ? 'sora2-gz-sp' : '');
    const resolution = String(node.videoResolution || '720p').toLowerCase();
    const duration = String(node.videoDuration || '8');

    if (family === 'sora') {
      return model;
    }
    if (family === 'veo') {
      const isVeo31Route1 = ['veo3.1-fl', 'veo-3.1', 'veo3.1'].includes(model.toLowerCase());
      if (isVeo31Route1) {
        const is1080 = resolution === '1080p';
        const isRef = node.videoGenerationType === 'reference';
        if (isRef) {
          return is1080 ? 'veo3.1-hd' : 'veo3.1';
        } else {
          return is1080 ? 'veo3.1-hd-fl' : 'veo3.1-fl';
        }
      } else {
        if (resolution && resolution !== '720p') {
          return `${model}-${resolution}`;
        }
        return model;
      }
    }
    if (family === 'omni') {
      if (model === 'omni-10s') {
        return 'omni-10s';
      }
      if (hasVideoRefs) {
        return `${model}-${resolution}-video`;
      }
      return `${model}-${resolution}-${duration}s`;
    }
    if (family === 'seedance') {
      const map = {
        '720p': 'sd2_mx_720p',
        '1080p': 'sd2_mx_1080p',
        '2k': 'sd2_mx_2k',
        '4k': 'sd2_mx_4k',
      };
      return map[resolution] || 'sd2_mx_720p';
    }
    if (family === 'grok') {
      return 'grok_video3';
    }
  }

  if (node.type === 'audio') {
    return 'gpt-4o-mini-tts';
  }

  return '';
}

export function calculateEstimatedCost(pricingList, node, profile, options = {}) {
  if (!pricingList || !node) return 0;
  
  const billingModel = resolveBillingModelName(node, options);
  if (!billingModel) return 0;

  const p = pricingList.find(item => item.model_name === billingModel);
  if (!p) return 0;

  const unitPrice = calculateCost(pricingList, billingModel, profile);
  const pricingType = p.pricing_type || 'standard';

  if (pricingType === 'seconds') {
    const duration = Number(options.duration || (node.type === 'video' ? node.videoDuration : 0)) || 0;
    if (duration > 0) {
      return Math.round(unitPrice * duration * 10000) / 10000;
    }
    return 0;
  }
  
  return unitPrice;
}
