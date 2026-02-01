'use client'
import React, { useEffect, useState } from 'react'
import Container from 'react-bootstrap/Container';
import axios from 'axios';
import { useRouter } from 'next/router'

import styles from '@/styles/page.module.css'

import Form from 'react-bootstrap/Form';

import InputLabel from '@/components/Form/InputLabel'
import SelectAddress from '@/components/Form/SelectAddress';
import TextareaLabel from '@/components/Form/TextareaLabel'
import ModalAlert from '@/components/Modals/ModalAlert'
import ButtonState from '@/components/Button/ButtonState';
import DatePickerX from '@/components/DatePicker/DatePickerX';

// 🔥 Import Validation
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userEditSchema, UserEditFormData } from '@/components/validations/cuserinfoSchema';

// 🔥 Import Hook
import { useThaiAddress } from '@/hooks/useThaiAddress';

import { encrypt } from '@/utils/helpers'

interface UserData {
    isLogin: boolean;
    data: UserDataProps | null
}

const Cuserinfo = () => {
    const router = useRouter();

    const [alert, setAlert] = useState({ show: false, message: '' });
    const [startDate, setStartDate] = useState<Date | null>(new Date());
    const [dataUser, setDataUser] = useState<UserData>({ isLogin: false, data: null })

    // 🔥 เรียกใช้ Thai Address Hook
    const { data, status, selected, actions, getNames, getLabel } = useThaiAddress();

    // 🔥 ใช้ React Hook Form
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting }
    } = useForm<UserEditFormData>({
        resolver: zodResolver(userEditSchema),
        mode: "onChange",
        defaultValues: {
            users_pin: "",
            users_tel1: "",
            users_postcode: ""
        }
    });

    // 🔥 ฟังก์ชันเช็คว่าควรขึ้น "สีเขียว" หรือไม่
    const isFieldValid = (name: keyof UserEditFormData) => {
        const value = watch(name);
        const hasError = !!errors[name]; // เช็คว่า Zod พ่น Error ออกมาหรือไม่ [cite: 10]

        // คืนค่า true (สีเขียว) เฉพาะเมื่อไม่มี error และมีค่าจริงเท่านั้น [cite: 15, 76]
        return !hasError && !!value && value.toString().trim() !== "";
    };

    useEffect(() => {
        const auToken = router.query.auToken
        if (auToken) {
            // เรียก API ตรงๆ ใน useEffect
            const fetchUserData = async () => {
                try {
                    const responseUser = await axios.get(`${process.env.WEB_DOMAIN}/api/user/getUser/${auToken}`);
                    if (responseUser.data?.data) {
                        const userData = responseUser.data.data;
                        setDataUser({ isLogin: false, data: userData });

                        // 🔥 ใช้ reset เพื่อกำหนดค่าเริ่มต้นให้กับ form
                        reset({
                            users_fname: userData.users_fname,
                            users_sname: userData.users_sname,
                            users_pin: String(userData.users_pin), // 🔥 แปลง number → string
                            users_number: userData.users_number,
                            users_moo: userData.users_moo,
                            users_road: userData.users_road,
                            users_tubon: userData.users_tubon,
                            users_amphur: userData.users_amphur,
                            users_province: userData.users_province,
                            users_postcode: userData.users_postcode,
                            users_tel1: userData.users_tel1,
                        });
                    } else {
                        setDataUser({ isLogin: false, data: null })
                    }
                } catch (error) {
                    console.log("🚀 ~ file: Cuserinfo.tsx ~ onGetUserData ~ error:", error)
                    setDataUser({ isLogin: false, data: null })
                    setAlert({ show: true, message: 'ระบบไม่สามารถดึงข้อมูลของท่านได้ กรุณาลองใหม่อีกครั้ง' })
                }
            };

            fetchUserData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.query.auToken])

    // 🔥 useEffect แยกสำหรับ set dropdown เมื่อข้อมูลจังหวัดโหลดเสร็จแล้ว
    useEffect(() => {
        if (dataUser.data && data.provinces.length > 0) {
            const userData = dataUser.data;
            // Set initial address values for dropdown
            if (userData.users_province && userData.users_amphur && userData.users_tubon) {
                actions.setInitialValues(
                    userData.users_province,
                    userData.users_amphur,
                    userData.users_tubon,
                    userData.users_postcode
                );
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataUser.data, data.provinces.length])

    const onSubmit = async (formData: UserEditFormData) => {
        try {
            if (!dataUser.data) {
                return;
            }

            const data = {
                users_fname: formData.users_fname,
                users_sname: formData.users_sname,
                users_pin: Number(formData.users_pin), // 🔥 แปลง string → number
                users_number: formData.users_number,
                users_moo: formData.users_moo,
                users_road: formData.users_road,
                users_tubon: formData.users_tubon,
                users_amphur: formData.users_amphur,
                users_province: formData.users_province,
                users_postcode: formData.users_postcode,
                users_tel1: formData.users_tel1,
            }

            const encodedUsersId = encrypt(dataUser.data.users_id.toString());
            await axios.post(`${process.env.WEB_DOMAIN}/api/user/updateUser/${encodedUsersId}`, data)

            // Reload user data after update
            if (router.query.auToken) {
                const responseUser = await axios.get(`${process.env.WEB_DOMAIN}/api/user/getUser/${router.query.auToken}`);
                if (responseUser.data?.data) {
                    setDataUser({ isLogin: false, data: responseUser.data.data });
                }
            }

            setAlert({ show: true, message: 'บันทึกข้อมูลสำเร็จ' })

        } catch (error) {
            console.error('Error in handleSubmit:', error);
            setAlert({ show: true, message: 'ไม่สามารถบันทึกข้อมูลได้' })
        }
    };

    if (dataUser.isLogin) return <div>loading...</div>;
    return (
        <Container>
            <div className={styles.main}>
                <h1 className="py-2">ข้อมูลผู้ดูแล</h1>
            </div>
            <div className="px-5">
                <Form noValidate onSubmit={handleSubmit(onSubmit)}>

                    <InputLabel
                        label="ชื่อ"
                        id="users_fname"
                        placeholder="กรอกชื่อ"
                        {...register("users_fname")}
                        isInvalid={!!errors.users_fname}
                        errorMessage={errors.users_fname?.message}
                        isValid={isFieldValid("users_fname")}
                        required
                    />

                    <InputLabel
                        label="นามสกุล"
                        id="users_sname"
                        placeholder="กรอกนามสกุล"
                        {...register("users_sname")}
                        isInvalid={!!errors.users_sname}
                        errorMessage={errors.users_sname?.message}
                        isValid={isFieldValid("users_sname")}
                        required
                    />

                    <InputLabel
                        label="Pin 4 หลัก"
                        id="users_pin"
                        placeholder="1234"
                        type="tel"
                        max={4}
                        {...register("users_pin")}
                        isInvalid={!!errors.users_pin}
                        errorMessage={errors.users_pin?.message}
                        isValid={isFieldValid("users_pin")}
                        required
                    />

                    <InputLabel
                        label="เลขที่บ้าน"
                        id="users_number"
                        placeholder="123/12"
                        max={10}
                        {...register("users_number")}
                        isValid={isFieldValid("users_number")}
                    />

                    <InputLabel
                        label="หมู่"
                        id="users_moo"
                        placeholder="1"
                        max={5}
                        {...register("users_moo")}
                        isValid={isFieldValid("users_moo")}
                    />

                    <InputLabel
                        label="ถนน"
                        id="users_road"
                        placeholder="-"
                        {...register("users_road")}
                        isValid={isFieldValid("users_road")}
                    />

                    {/* 🔥 เปลี่ยนจาก Input เป็น Dropdown */}
                    {status.loading ? (
                        <p className="text-muted">กำลังโหลดข้อมูลจังหวัด...</p>
                    ) : (
                        <>
                            <input type="hidden" {...register("users_province")} />
                            <input type="hidden" {...register("users_amphur")} />
                            <input type="hidden" {...register("users_tubon")} />

                            <SelectAddress
                                label="จังหวัด"
                                id="users_province"
                                value={selected.provinceId}
                                options={data.provinces}
                                onChange={(id) => {
                                    actions.setProvince(id); // อัปเดต State ใน hook [cite: 216]
                                    const name = getNames.getProvinceName(id); // ดึงชื่อภาษาไทย 
                                    // สั่ง setValue พร้อม shouldValidate เพื่อให้ Zod ตรวจสอบทันที [cite: 10, 76]
                                    setValue("users_province", name, { shouldValidate: true });
                                }}
                                placeholder="เลือกจังหวัด"
                                isInvalid={!!errors.users_province}
                                errorMessage={errors.users_province?.message}
                                isValid={isFieldValid("users_province")}
                                required
                                getLabel={getLabel}
                            />

                            <SelectAddress
                                label="อำเภอ"
                                id="users_amphur"
                                value={selected.districtId}
                                options={data.districts}
                                onChange={(id) => {
                                    actions.setDistrict(id);
                                    const name = getNames.getDistrictName(id);
                                    setValue("users_amphur", name, { shouldValidate: true });
                                }}
                                disabled={!selected.provinceId}
                                placeholder={!selected.provinceId ? "เลือกจังหวัดก่อน" : "เลือกอำเภอ"}
                                isInvalid={!!errors.users_amphur}
                                errorMessage={errors.users_amphur?.message}
                                isValid={isFieldValid("users_amphur")}
                                required
                                getLabel={getLabel}
                            />

                            <SelectAddress
                                label="ตำบล"
                                id="users_tubon"
                                value={selected.subDistrictId}
                                options={data.subDistricts}
                                onChange={(id) => {
                                    actions.setSubDistrict(id);
                                    const name = getNames.getSubDistrictName(id);
                                    setValue("users_tubon", name, { shouldValidate: true });

                                    // ดึงรหัสไปรษณีย์จากข้อมูลตำบลมาใส่ในฟอร์มทันที [cite: 219]
                                    const subDist = data.subDistricts.find(s => s.id === Number(id));
                                    setValue("users_postcode", subDist?.zip_code ? String(subDist.zip_code) : "", { shouldValidate: true });
                                }}
                                disabled={!selected.districtId}
                                placeholder={!selected.districtId ? "เลือกอำเภอก่อน" : "เลือกตำบล"}
                                isInvalid={!!errors.users_tubon}
                                errorMessage={errors.users_tubon?.message}
                                isValid={isFieldValid("users_tubon")}
                                required
                                getLabel={getLabel}
                            />
                        </>
                    )}

                    <InputLabel
                        label="รหัสไปรษณีย์"
                        id="users_postcode"
                        placeholder="รหัสไปรษณีย์จะถูกกรอกอัตโนมัติ"
                        type="tel"
                        max={5}
                        {...register("users_postcode")}
                        isInvalid={!!errors.users_postcode}
                        errorMessage={errors.users_postcode?.message}
                        isValid={isFieldValid("users_postcode")}
                        readOnly
                        required
                    />

                    <InputLabel
                        label="เบอร์โทรศัพท์"
                        id="users_tel1"
                        placeholder="กรอกเบอร์โทรศัพท์"
                        type="tel"
                        max={10}
                        {...register("users_tel1")}
                        isInvalid={!!errors.users_tel1}
                        errorMessage={errors.users_tel1?.message}
                        isValid={isFieldValid("users_tel1")}
                        required
                    />

                    <Form.Group className="d-flex justify-content-center py-3">
                        <ButtonState
                            type="submit"
                            className={styles.button}
                            text={'บันทึก'}
                            icon="fas fa-save"
                            isLoading={isSubmitting}
                        />
                    </Form.Group>

                </Form>
            </div>
            <ModalAlert show={alert.show} message={alert.message} handleClose={() => setAlert({ show: false, message: '' })} />
        </Container>
    )
}

export default Cuserinfo