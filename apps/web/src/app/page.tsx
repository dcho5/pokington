
"use client";

import dynamic from 'next/dynamic';

const HomePage = dynamic(() => import('./page.client'), { ssr: false });

export default HomePage;
