import React from 'react';
import logo from '../assets/images/logo.png';

// The DairyDan mark. Decorative: it always sits next to the "DairyDan" name,
// so screen readers skip it (empty alt) instead of announcing the brand twice.
const Logo = () => <img src={logo} alt="" className="brand-logo" width="36" height="36" />;

export default Logo;
