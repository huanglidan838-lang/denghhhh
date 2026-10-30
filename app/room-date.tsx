'use client';
import {useEffect,useState} from 'react';
export function RoomDate(){const [date,setDate]=useState('');useEffect(()=>{const update=()=>setDate(new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'}));update();const timer=setInterval(update,30000);return()=>clearInterval(timer)},[]);return <time className="room-date" aria-label="今天的日期和星期">{date}</time>}
